// import format from 'pg-format';
// import { EntityMetadata } from 'typeorm';
// import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
// import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
// import { snakeCase } from 'typeorm/util/StringUtils';

// import { getCloudId } from '../../../services/cloud-id';
// import logger from '../../../services/logger';
// import { TypeormWrapper } from '../../../services/typeorm';
// import { AuditLogChangeType, IasqlAuditLog } from '../../iasql_platform/entity';
// import { MapperBase, ModuleInterface } from '../../interfaces';

// /**
//  * @internal
//  * Returns the queries recreated from the change logs.
//  */
// export async function recreateQueries(
//   changeLogs: IasqlAuditLog[],
//   modsIndexedByTable: { [key: string]: ModuleInterface },
//   orm: TypeormWrapper,
// ): Promise<string[]> {
//   const queries: string[] = [];
//   for (const cl of changeLogs) {
//     let query: string = '';
//     switch (cl.changeType) {
//       case AuditLogChangeType.INSERT:
//         const insertedEntries = Object.entries(cl.change?.change ?? {}).filter(
//           ([k, v]: [string, any]) => k !== 'id' && v !== null,
//         );
//         const valuesToInsert = await Promise.all(
//           insertedEntries.map(
//             async ([k, v]: [string, any]) =>
//               await findRelationOrReturnFormattedValue(cl.tableName, k, v, modsIndexedByTable, orm),
//           ),
//         );
//         query = format(
//           `
//           INSERT INTO %I (${insertedEntries.map(_ => '%I').join(', ')})
//           VALUES (${insertedEntries.map(_ => '%s').join(', ')});
//         `,
//           cl.tableName,
//           ...insertedEntries.map(([k, _]: [string, any]) => k),
//           ...valuesToInsert,
//         );
//         break;
//       case AuditLogChangeType.DELETE:
//         const relevantEntries = Object.entries(cl.change?.original ?? {}).filter(
//           ([k, v]: [string, any]) => k !== 'id' && v !== null,
//         );
//         const valuesDeleted = await Promise.all(
//           relevantEntries.map(async ([k, v]: [string, any]) => {
//             const value = await findRelationOrReturnFormattedValue(
//               cl.tableName,
//               k,
//               v,
//               modsIndexedByTable,
//               orm,
//             );
//             return {
//               key: k,
//               value,
//               hasJSONTypeMetadata: !value.includes('::jsonb') && value.includes('::json'),
//             };
//           }),
//         );
//         query = format(
//           `
//             DELETE FROM %I
//             WHERE ${relevantEntries
//               .map(
//                 ([_, v]: [string, any], i) =>
//                   `${
//                     (typeof v === 'object' && !Array.isArray(v)) || valuesDeleted[i].hasJSONTypeMetadata
//                       ? '%I::jsonb = %s'
//                       : '%I = %s'
//                   }`,
//               )
//               .join(' AND ')};
//           `,
//           cl.tableName,
//           ...relevantEntries.flatMap(([k, _]: [string, any], i) => {
//             // On WHERE clauses we cannot compare JSON objects so we need to use the `::jsonb` cast in both, column and value.
//             if (valuesDeleted[i].hasJSONTypeMetadata) {
//               return [k, valuesDeleted[i].value.replace('::json', '::jsonb')];
//             }
//             return [k, valuesDeleted[i].value];
//           }),
//         );
//         break;
//       case AuditLogChangeType.UPDATE:
//         const originalEntries = Object.entries(cl.change?.original ?? {})
//           // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
//           .filter(([k, v]: [string, any]) => k !== 'ami' && k !== 'id' && v !== null);
//         const updatedEntries = Object.entries(cl.change?.change ?? {}).filter(
//           ([k, _]: [string, any]) => k !== 'id',
//         );
//         const updatedValues = await Promise.all(
//           updatedEntries.map(
//             async ([k, v]: [string, any]) =>
//               await findRelationOrReturnFormattedValue(cl.tableName, k, v, modsIndexedByTable, orm),
//           ),
//         );
//         const oldValues = await Promise.all(
//           originalEntries.map(async ([k, v]: [string, any]) => {
//             const value = await findRelationOrReturnFormattedValue(
//               cl.tableName,
//               k,
//               v,
//               modsIndexedByTable,
//               orm,
//             );
//             return {
//               key: k,
//               value,
//               hasJSONTypeMetadata: !value.includes('::jsonb') && value.includes('::json'),
//             };
//           }),
//         );
//         query = format(
//           `
//           UPDATE %I
//           SET ${updatedEntries.map(_ => `%I = %s`).join(', ')}
//           WHERE ${originalEntries
//             .map(
//               ([_, v]: [string, any], i) =>
//                 `${
//                   (typeof v === 'object' && !Array.isArray(v)) || oldValues[i].hasJSONTypeMetadata
//                     ? '%I::jsonb = %s'
//                     : '%I = %s'
//                 }`,
//             )
//             .join(' AND ')};
//         `,
//           cl.tableName,
//           ...updatedEntries.flatMap(([k, _]: [string, any], i) => [k, updatedValues[i]]),
//           ...originalEntries.flatMap(([k, _]: [string, any], i) => {
//             // On WHERE clauses we cannot compare JSON objects so we need to use the `::jsonb` cast in both, column and value.
//             if (oldValues[i].hasJSONTypeMetadata) return [k, oldValues[i].value.replace('::json', '::jsonb')];
//             return [k, oldValues[i].value];
//           }),
//         );
//         break;
//       default:
//         break;
//     }
//     if (query) queries.push(query);
//   }
//   return queries;
// }

// /**
//  * @internal
//  * The changes from iasql_audit_log are stored as JSON.
//  * We need to look if the value is a relation to other table and return the respective sub-query
//  * or return a formatted value for the query.
//  */
// async function findRelationOrReturnFormattedValue(
//   tableName: string,
//   key: string,
//   value: any,
//   modsIndexedByTable: { [key: string]: ModuleInterface },
//   orm: TypeormWrapper,
// ): Promise<string> {
//   // We might need to recreate a sub-query because it could be column referencing other table.
//   // For this we need to get Typeorm metadata for the `tableName` and inspect the columns and relations in order to recreate the sub-query if necessary.
//   // We need to recreate the sub-query because related columns might not be the same across databases connected to the same cloud account.
//   const metadata = await getMetadata(tableName, modsIndexedByTable, orm);
//   let columnMetadata: ColumnMetadata | undefined;
//   if (value && metadata) {
//     // If `metadata instanceof EntityMetadata` means that there's an Entity in Typeorm which it's table name is `tableName`
//     if (metadata instanceof EntityMetadata) {
//       columnMetadata = metadata.ownColumns.filter(oc => oc.databaseName === key)?.pop();
//       if (!!columnMetadata?.relationMetadata) {
//         return await recreateSubQuery(
//           columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
//           columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
//           value,
//           columnMetadata.relationMetadata?.inverseEntityMetadata,
//           modsIndexedByTable,
//           orm,
//         );
//       }
//     }
//     // If `metadata instanceof RelationMetadata` means that there's no Entity in Typeorm which it's table name is `tableName`,
//     // but theres a join table linking entities and `tableName` is that join table. In this case we need to check `joinColumns`
//     // which will have the columns from the owner of the relationship and `inverseJoinColumns` will have the columns coming from
//     // the other entities in the relationship.
//     if (metadata instanceof RelationMetadata) {
//       columnMetadata = metadata.joinColumns.filter(jc => jc.databaseName === key)?.pop();
//       if (!!columnMetadata?.relationMetadata) {
//         return await recreateSubQuery(
//           columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
//           columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
//           value,
//           columnMetadata.relationMetadata?.entityMetadata,
//           modsIndexedByTable,
//           orm,
//         );
//       }
//       columnMetadata = metadata.inverseJoinColumns.filter(jc => jc.databaseName === key)?.pop();
//       if (!!columnMetadata?.relationMetadata) {
//         return await recreateSubQuery(
//           columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
//           columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
//           value,
//           columnMetadata.relationMetadata?.inverseEntityMetadata,
//           modsIndexedByTable,
//           orm,
//         );
//       }
//     }
//   }
//   // Arrays have special behaviour in postgres. We try to cast the right array type when possible.
//   if (columnMetadata && columnMetadata.isArray) {
//     return typeof columnMetadata.type === 'string'
//       ? format('array[%L]::%I[]', value, columnMetadata.type)
//       : format('array[%L]', value);
//   } else if (typeof value === 'object' && Array.isArray(value)) {
//     return typeof columnMetadata?.type === 'string'
//       ? format('%L::%I', JSON.stringify(value), columnMetadata.type)
//       : format('%L', JSON.stringify(value));
//   }
//   return format('%L', value);
// }

// /**
//  * @internal
//  * Returns Typeorm metadata related to `tableName`
//  */
// async function getMetadata(
//   tableName: string,
//   modsIndexedByTable: { [key: string]: ModuleInterface },
//   orm: TypeormWrapper,
// ): Promise<EntityMetadata | RelationMetadata | undefined> {
//   const mappers = Object.values(modsIndexedByTable[tableName] ?? {}).filter(val => val instanceof MapperBase);
//   let metadata: EntityMetadata | RelationMetadata | undefined;
//   for (const m of mappers) {
//     const tableEntity = (m as MapperBase<any>).entity;
//     const entityMetadata = await orm.getEntityMetadata(tableEntity);
//     if (entityMetadata.tableName === tableName) {
//       metadata = entityMetadata;
//       break;
//     } else {
//       if (
//         entityMetadata.ownRelations
//           .filter(or => !!or.joinTableName)
//           .map(or => or.joinTableName)
//           .includes(tableName)
//       ) {
//         metadata = entityMetadata.ownRelations.find(or => or.joinTableName === tableName);
//         break;
//       }
//     }
//   }
//   // If no metadata found, we need to do a second pass over the mappers because it could be the case of an
//   // Entity that does not have it's own mapper but it is managed by another Entity Mapper.
//   if (!metadata) {
//     for (const m of mappers) {
//       const tableEntity = (m as MapperBase<any>).entity;
//       const entityMetadata = await orm.getEntityMetadata(tableEntity);
//       if (
//         entityMetadata.ownRelations
//           .filter(or => !!or.inverseEntityMetadata.tableName)
//           .map(or => or.inverseEntityMetadata.tableName)
//           .includes(tableName)
//       ) {
//         metadata = entityMetadata.ownRelations.find(
//           or => or.inverseEntityMetadata.tableName === tableName,
//         )?.inverseEntityMetadata;
//         break;
//       }
//     }
//   }
//   return metadata;
// }

// /**
//  * @internal
//  * Returns sub-query based on the referenced column in the relation.
//  * The related entity will be found using the cloud columns decorators.
//  */
// async function recreateSubQuery(
//   referencedDbKey: string,
//   referencedKey: string,
//   value: any,
//   entityMetadata: EntityMetadata | undefined,
//   modsIndexedByTable: { [key: string]: ModuleInterface },
//   orm: TypeormWrapper,
// ): Promise<string> {
//   // Get cloud columns of the entity we want to look for.
//   const cloudColumns = getCloudId(entityMetadata?.target);
//   if (cloudColumns && !(cloudColumns instanceof Error)) {
//     let e: any;
//     try {
//       e = await orm.findOne(entityMetadata?.targetName ?? '', { where: { [referencedKey]: value } });
//     } catch (e: any) {
//       logger.warn(e.message ?? 'Error finding relation');
//       e = null;
//     }
//     // Entity might have been deleted.
//     if (e === null) return '<relation_not_found>';
//     let values = await Promise.all(
//       cloudColumns.map(
//         async (cc: string) =>
//           await findRelationOrReturnFormattedValue(
//             entityMetadata?.tableName ?? 'unknown_table',
//             cc,
//             e?.[cc],
//             modsIndexedByTable,
//             orm,
//           ),
//       ),
//     );
//     // If all cloud column values are null is quite useless to do the query, then we fall back to all db columns with values
//     // since they will help to identify the record.
//     let dbColumns: string[] = [];
//     if (values.every(v => v === 'NULL')) {
//       dbColumns =
//         entityMetadata?.ownColumns
//           .filter(oc => !oc.relationMetadata && !!e[oc.propertyName] && !oc.isPrimary)
//           .map(oc => oc.propertyName) ?? [];
//       values = await Promise.all(
//         dbColumns.map(
//           async (dbc: string) =>
//             await findRelationOrReturnFormattedValue(
//               entityMetadata?.tableName ?? 'unknown_table',
//               dbc,
//               e?.[dbc],
//               modsIndexedByTable,
//               orm,
//             ),
//         ),
//       );
//     }
//     const columns = dbColumns.length ? dbColumns : cloudColumns;
//     const subQuery = format(
//       `SELECT %I FROM %I WHERE ${columns.map(_ => '%I = %s').join(' AND ')}`,
//       referencedDbKey,
//       entityMetadata?.tableName,
//       ...columns.flatMap((c, i) => [snakeCase(c), values[i] !== undefined ? values[i] : '<unknown value>']),
//     );
//     return `(${subQuery})`;
//   }
//   return '';
// }
