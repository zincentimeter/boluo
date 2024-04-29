use super::api::{EditMessage, NewMessage};
use super::Message;
use crate::channels::{Channel, ChannelMember};
use crate::csrf::authenticate;
use crate::error::{AppError, Find};
use crate::events::Event;
use crate::interface::{missing, ok_response, parse_query, Response};
use crate::messages::api::{GetMessagesByChannel, MoveMessageBetween};
use crate::spaces::SpaceMember;
use crate::{db, interface};
use hyper::{Body, Request};

async fn send(req: Request<Body>) -> Result<Message, AppError> {
    let session = authenticate(&req).await?;
    let NewMessage {
        message_id: _,
        preview_id,
        channel_id,
        name,
        text,
        entities,
        in_game,
        is_action,
        media_id,
        whisper_to_users,
        pos: request_pos,
        color,
    } = interface::parse_body(req).await?;
    let pool = db::get().await;
    let mut conn = pool.acquire().await?;
    let (channel_member, space_member) =
        ChannelMember::get_with_space_member(&mut *conn, &session.user_id, &channel_id)
            .await
            .or_no_permission()?;
    let mut cache = crate::cache::conn().await?;
    let message = Message::create(
        &mut conn,
        &mut cache,
        preview_id.as_ref(),
        &channel_id,
        &session.user_id,
        &channel_member.character_name,
        &name,
        &text,
        entities,
        in_game,
        is_action,
        channel_member.is_master,
        whisper_to_users,
        media_id,
        request_pos,
        color,
    )
    .await?;
    Event::new_message(space_member.space_id, message.clone(), preview_id);
    Ok(message)
}

async fn edit(req: Request<Body>) -> Result<Message, AppError> {
    let session = authenticate(&req).await?;
    let EditMessage {
        message_id,
        name,
        text,
        entities,
        in_game,
        is_action,
        media_id,
        color,
    } = interface::parse_body(req).await?;
    let pool = db::get().await;
    let mut trans = pool.begin().await?;
    let mut message = Message::get(&mut *trans, &message_id, Some(&session.user_id))
        .await?
        .or_not_found()?;
    let channel = Channel::get_by_id(&mut *trans, &message.channel_id)
        .await
        .or_not_found()?;
    let (_, space_member) = ChannelMember::get_with_space_member(&mut *trans, &session.user_id, &message.channel_id)
        .await
        .or_no_permission()?;
    if !channel.is_document && message.sender_id != session.user_id {
        return Err(AppError::NoPermission("user id dismatch".to_string()));
    }

    let text = &*text;
    let name = &*name;
    message = Message::edit(
        &mut *trans,
        name,
        &message_id,
        text,
        entities,
        in_game,
        is_action,
        media_id,
        color,
    )
    .await?
    .ok_or_else(|| unexpected!("The message had been delete."))?;
    trans.commit().await?;
    Event::message_edited(space_member.space_id, message.clone());
    Ok(message)
}

async fn move_between(req: Request<Body>) -> Result<bool, AppError> {
    let session = authenticate(&req).await?;
    let MoveMessageBetween {
        message_id,
        channel_id,
        range,
    } = interface::parse_body(req).await?;

    let pool = db::get().await;
    let mut trans = pool.begin().await?;
    let message = Message::get(&mut *trans, &message_id, Some(&session.user_id))
        .await
        .or_not_found()?;
    let channel = Channel::get_by_id(&mut *trans, &message.channel_id)
        .await
        .or_not_found()?;
    let channel_member = ChannelMember::get(&mut *trans, &session.user_id, &message.channel_id)
        .await
        .or_no_permission()?;
    if !channel.is_document && !channel_member.is_master && message.sender_id != session.user_id {
        return Err(AppError::NoPermission(
            "Only the master can move other's messages.".to_string(),
        ));
    }

    let mut message = match range {
        (None, None) => return Err(AppError::BadRequest("a and b cannot both be null".to_string())),
        (Some(a), _) => Message::move_bottom(&mut *trans, &channel_id, &message_id, a)
            .await?
            .or_not_found()?,
        (None, Some(b)) => Message::move_above(&mut *trans, &channel_id, &message_id, b)
            .await?
            .or_not_found()?,
    };

    trans.commit().await?;
    if message.whisper_to_users.is_some() {
        message.hide();
    }
    Event::message_edited(channel.space_id, message);
    Ok(true)
}

async fn query(req: Request<Body>) -> Result<Message, AppError> {
    let interface::IdQuery { id } = interface::parse_query(req.uri())?;
    let user_id = authenticate(&req).await.ok().map(|session| session.user_id);
    Message::get(&db::get().await, &id, user_id.as_ref())
        .await
        .or_not_found()
}

async fn delete(req: Request<Body>) -> Result<Message, AppError> {
    let session = authenticate(&req).await?;
    let interface::IdQuery { id } = interface::parse_query(req.uri())?;
    let pool = db::get().await;
    let mut conn = pool.acquire().await?;
    let message = Message::get(&mut *conn, &id, Some(&session.user_id))
        .await
        .or_not_found()?;
    let space_member = SpaceMember::get_by_channel(&mut *conn, &session.user_id, &message.channel_id)
        .await
        .or_no_permission()?;
    if !space_member.is_admin && message.sender_id != session.user_id {
        return Err(AppError::NoPermission("user id mismatch".to_string()));
    }
    Message::delete(&mut *conn, &id).await?;
    Event::message_deleted(space_member.space_id, message.channel_id, message.id);
    Ok(message)
}

async fn toggle_fold(req: Request<Body>) -> Result<Message, AppError> {
    let session = authenticate(&req).await?;
    let interface::IdQuery { id } = interface::parse_query(req.uri())?;
    let pool = db::get().await;
    let mut conn = pool.acquire().await?;
    let message = Message::get(&mut *conn, &id, Some(&session.user_id))
        .await
        .or_not_found()?;
    let channel = Channel::get_by_id(&mut *conn, &message.channel_id)
        .await
        .or_not_found()?;
    let channel_member = ChannelMember::get(&mut *conn, &session.user_id, &message.channel_id)
        .await
        .or_no_permission()?;
    if !channel.is_document && message.sender_id != session.user_id && !channel_member.is_master {
        return Err(AppError::NoPermission("user id dismatch".to_string()));
    }
    let message = Message::set_folded(&mut *conn, &message.id, !message.folded)
        .await?
        .ok_or_else(|| unexpected!("message not found"))?;
    Event::message_edited(channel.space_id, message.clone());
    Ok(message)
}

async fn by_channel(req: Request<Body>) -> Result<Vec<Message>, AppError> {
    let GetMessagesByChannel {
        channel_id,
        limit,
        before,
    } = parse_query(req.uri())?;

    let pool = db::get().await;
    let mut conn = pool.acquire().await?;

    let channel = Channel::get_by_id(&mut *conn, &channel_id).await.or_not_found()?;
    if !channel.is_public {
        let session = authenticate(&req).await?;
        ChannelMember::get(&mut *conn, &session.user_id, &channel_id)
            .await
            .or_no_permission()?;
    }
    let limit = limit.unwrap_or(128);
    Message::get_by_channel(&mut *conn, &channel_id, before, limit)
        .await
        .map_err(Into::into)
}

pub async fn router(req: Request<Body>, path: &str) -> Result<Response, AppError> {
    use hyper::Method;

    match (path, req.method().clone()) {
        ("/query", Method::GET) => query(req).await.map(ok_response),
        ("/by_channel", Method::GET) => by_channel(req).await.map(ok_response),
        ("/send", Method::POST) => send(req).await.map(ok_response),
        ("/edit", Method::POST) => edit(req).await.map(ok_response),
        ("/edit", Method::PUT) => edit(req).await.map(ok_response),
        ("/edit", Method::PATCH) => edit(req).await.map(ok_response),
        ("/move_between", Method::POST) => move_between(req).await.map(ok_response),
        ("/toggle_fold", Method::POST) => toggle_fold(req).await.map(ok_response),
        ("/delete", Method::POST) => delete(req).await.map(ok_response),
        _ => missing(),
    }
}
