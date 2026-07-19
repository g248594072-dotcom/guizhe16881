import { defineMvuDataStore } from '@util/mvu';
import { Schema } from '../../schema';

<<<<<<< HEAD
export const useDataStore = defineMvuDataStore(Schema, () => ({
  type: 'message',
  message_id: getCurrentMessageId(),
}));
=======
export const useDataStore = defineMvuDataStore(Schema, { type: 'message', message_id: getCurrentMessageId() });
>>>>>>> a4d60f52b8b1b0f872a80088ba7e339b0933eeb2
