import * as React from 'react';
import Title from '../atoms/Title';
import { useParams } from 'react-router-dom';
import { useFetch, useRefetch, useTitleWithFetchResult } from '../../hooks';
import { AppResult, get } from '../../api/request';
import { SpaceWithRelated } from '../../api/spaces';
import Loading from '../molecules/Loading';
import NotFound from './NotFound';
import Tag from '../atoms/Tag';
import Button from '../atoms/Button';
import { useProfile } from '../Provider';
import { mR, mT, preLine, textXl } from '../../styles/atoms';
import binoculars from '../../assets/icons/binoculars.svg';
import teleport from '../../assets/icons/teleport.svg';
import handOfGod from '../../assets/icons/hand-of-god.svg';
import Icon from '../atoms/Icon';
import JoinSpaceButton from '../molecules/JoinSpaceButton';
import LeaveSpaceButton from '../molecules/LeaveSpaceButton';

interface Params {
  id: string;
}

const buttonStyle = [mR(1), textXl];

function SpacePage() {
  const { id } = useParams<Params>();
  const [result, refetch] = useFetch<AppResult<SpaceWithRelated>>(() => get('/spaces/query_with_related', { id }), [
    id,
  ]);
  useRefetch(refetch);
  useTitleWithFetchResult<SpaceWithRelated>(result, ({ space }) => space.name);
  const profile = useProfile();
  if (result === 'LOADING') {
    return <Loading />;
  } else if (!result.isOk) {
    return <NotFound />;
  }
  const { space, members } = result.value;
  const myMember = profile?.spaces.get(id)?.member;
  return (
    <>
      <div>
        <Title css={[]}>{space.name}</Title>
      </div>
      <div>
        <Tag color="#38A169">{members.length} 名成员</Tag>
      </div>
      <div css={[preLine, mT(2)]}>{space.description}</div>
      <div css={[mT(4)]}>
        {myMember ? (
          <Button css={buttonStyle} data-variant="primary">
            <Icon sprite={teleport} /> 进入位面
          </Button>
        ) : (
          <Button css={buttonStyle}>
            <Icon sprite={binoculars} /> 作为旁观者进入
          </Button>
        )}
        {profile && !myMember && <JoinSpaceButton css={buttonStyle} id={space.id} />}
        {myMember?.isAdmin && (
          <Button css={buttonStyle}>
            <Icon sprite={handOfGod} /> 管理位面
          </Button>
        )}
        {myMember && <LeaveSpaceButton css={buttonStyle} id={space.id} name={space.name} />}
      </div>
    </>
  );
}

export default SpacePage;
