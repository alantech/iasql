import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from "typeorm"

function updateNulls(entity:any) {
    const that: any = entity;
    Object.keys(entity).forEach((k) => {
        if (that[k] === null) that[k] = undefined;
    });
  }    

@EventSubscriber()
export class NullCheckerSubscriber<T> implements EntitySubscriberInterface<T> {
    constructor(private cls: new (...a:any) => T) {

    }
    listenTo(): any {
      return this.cls;
    }

    afterLoad(entity: T, event?: LoadEvent<T> | undefined): void | Promise<any> {
        console.log("in after load");
        updateNulls(entity);
    }

    afterInsert(event: InsertEvent<T>): void | Promise<any> {
        console.log("in after insert");
        const { entity } = event;
        updateNulls(entity);        
    }

    afterUpdate(event: UpdateEvent<T>): void | Promise<any> {
        console.log("in after update");

        const { entity } = event;
        updateNulls(entity);
    }  
}