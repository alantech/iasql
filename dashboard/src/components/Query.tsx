import QueryResult from '../components/QueryResult';
import { VBox } from '../components/common';
import IasqlEditor from './IasqlEditor';

export default function Query() {
  return (
    <VBox>
      <IasqlEditor />
      <QueryResult />
    </VBox>
  );
}
