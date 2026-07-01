import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';

<<<<<<< HEAD
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
=======
export const useDataStore = defineMvuDataStore(Schema, { type: 'message', message_id: getCurrentMessageId() });
>>>>>>> 92bc9ed4a5ff1e65a494b9644780983031cdb1df
