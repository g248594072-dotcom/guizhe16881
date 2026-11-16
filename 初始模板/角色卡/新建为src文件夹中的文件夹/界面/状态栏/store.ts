import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';

<<<<<<< HEAD
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
=======
export const useDataStore = defineMvuDataStore(Schema, { type: 'message', message_id: getCurrentMessageId() });
>>>>>>> f8b20765c5ce38a1e065c2a84b9882d8fac75f97
