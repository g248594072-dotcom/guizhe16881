import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';

<<<<<<< HEAD
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
=======
export const useDataStore = defineMvuDataStore(Schema, { type: 'message', message_id: getCurrentMessageId() });
>>>>>>> 6a70f8e1a961db42005bf8013b76cf97e1512794
