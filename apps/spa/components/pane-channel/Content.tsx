import clsx from 'clsx';
import { memo, type ReactNode, useMemo } from 'react';
import type { Entity, EvaluatedExprNode } from '../../interpreter/entities';
import { evaluate, makeRng } from '../../interpreter/eval';
import { EntityCode } from '../entities/EntityCode';
import { EntityCodeBlock } from '../entities/EntityCodeBlock';
import { EntityEmphasis } from '../entities/EntityEmphasis';
import { EntityExpr } from '../entities/EntityExpr';
import { EntityLink } from '../entities/EntityLink';
import { EntityStrong } from '../entities/EntityStrong';
import { EntityText } from '../entities/EntityText';
import { EntityEvaluatedExpr } from '../entities/EntityEvaluatedExpr';
import { ZERO_WIDTH_SPACE } from '../../const';

interface Props {
  source: string;
  entities: Entity[];
  isAction: boolean;
  isArchived: boolean;
  self?: boolean;
  seed?: number[];
  nameNode: ReactNode;
}

export type EvaluatedExpr = { type: 'EvaluatedExpr'; node: EvaluatedExprNode; start: number; len: number };

export const Content = memo<Props>(({ source, entities, isAction, isArchived, nameNode, seed, self = false }) => {
  const evaluatedEntities: Array<Entity | EvaluatedExpr> = useMemo(() => {
    if (seed == null || seed.length !== 4) {
      return entities;
    }
    const rng = makeRng(seed);
    const extendedEntities: Array<Entity | EvaluatedExpr> = [];
    for (const entity of entities) {
      if (entity.type === 'Expr') {
        const evaluated = evaluate(entity.node, rng);
        extendedEntities.push({ type: 'EvaluatedExpr', node: evaluated, start: entity.start, len: entity.len });
      } else {
        extendedEntities.push(entity);
      }
    }
    return extendedEntities;
  }, [entities, seed]);
  const entityNodeList = useMemo(() => {
    if (evaluatedEntities.length === 0) {
      return <span>{ZERO_WIDTH_SPACE}</span>;
    }
    const nodeList = [];
    nodeList.push(
      ...evaluatedEntities.map((entity, index) => {
        switch (entity.type) {
          case 'Text':
            return <EntityText key={index} source={source} entity={entity} />;
          case 'Link':
            return <EntityLink key={index} source={source} entity={entity} />;
          case 'Strong':
            return <EntityStrong key={index} source={source} entity={entity} />;
          case 'Emphasis':
            return <EntityEmphasis key={index} source={source} entity={entity} />;
          case 'Code':
            return <EntityCode key={index} source={source} entity={entity} />;
          case 'CodeBlock':
            return <EntityCodeBlock key={index} source={source} entity={entity} />;
          case 'Expr':
            return <EntityExpr key={index} source={source} entity={entity} />;
          case 'EvaluatedExpr':
            return <EntityEvaluatedExpr key={index} source={source} entity={entity} />;
        }
      }),
    );
    if (source[source.length - 1] === '\n') {
      // Add a space to prevent the last line from being collapsed
      nodeList.push(<span key="space"> </span>);
    }
    return nodeList;
  }, [source, evaluatedEntities]);
  return (
    <>
      <div
        className={clsx(
          'relative h-full whitespace-pre-wrap break-all',
          self ? 'pb-1' : '',
          isArchived ? 'decoration-highest/50 line-through' : '',
        )}
      >
        {isAction && <span className="text-message-action mr-1">*</span>}
        {isAction && nameNode}
        {entityNodeList}
      </div>
    </>
  );
});
Content.displayName = 'Content';
