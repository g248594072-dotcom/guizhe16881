import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';

<<<<<<< HEAD
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
=======
export const useDataStore = defineMvuDataStore(Schema, { type: 'message', message_id: getCurrentMessageId() });
>>>>>>> df19bf5a213c5e38b25c07c65b47a908c4cdd7ce
