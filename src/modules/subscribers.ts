import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from 'typeorm';

function updateNulls(entity: any) {
  if (entity) {
    const that: any = entity;
    Object.keys(entity).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}

function updateUndefined(entity: any) {
  if (entity) {
    const that: any = entity;
    Object.keys(entity).forEach(k => {
      if (that[k] === undefined) that[k] = null;
    });
  }
}

@EventSubscriber()
export class NullCheckerSubscriber implements EntitySubscriberInterface {
  afterLoad(entity: any) {
    updateNulls(entity);
  }

  afterInsert(event: InsertEvent<any>) {
    updateNulls(event.entity);
  }

  afterUpdate(event: UpdateEvent<any>) {
    updateNulls(event.entity);
  }

  // beforeInsert(event: InsertEvent<any>) {
  //   updateUndefined(event.entity);
  // }

  // beforeUpdate(event: UpdateEvent<any>) {
  //   updateUndefined(event.entity);
  // }
}
