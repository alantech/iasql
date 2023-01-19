import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';

function updateNulls(entity: any) {
  Object.keys(entity ?? {}).forEach(k => {
    if (entity[k] === null) entity[k] = undefined;
  });
}

function updateUndefined(entity: any) {
  Object.keys(entity ?? {}).forEach(k => {
    if (entity[k] === undefined) entity[k] = null;
  });
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

  beforeInsert(event: InsertEvent<any>) {
    updateUndefined(event.entity);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    updateUndefined(event.entity);
  }
}
