import { Schema } from 'mongoose';
import { encryptField, decryptField } from '../utils/crypto.util';

export type EncryptedField = {
  path: string;
  asType?: 'number' | 'object';
};

/**
 * Mongoose plugin that transparently encrypts fields at rest.
 *
 * - pre('save'): encrypts specified fields before writing to MongoDB
 * - post('init'): decrypts fields after any find/findOne/findById loads a document
 * - pre('findOneAndUpdate'/'updateOne'/'updateMany'): encrypts fields in update payloads
 * - post('findOneAndUpdate'): decrypts the returned document when { new: true } is used
 *
 * Usage:
 *   MySchema.plugin(encryptionPlugin, [
 *     { path: 'age', asType: 'number' },
 *     { path: 'bodyAnalysis', asType: 'object' },
 *   ]);
 */
export function encryptionPlugin(schema: Schema, fields: EncryptedField[]): void {
  // Encrypt before saving a full document
  schema.pre('save', function (next) {
    for (const { path } of fields) {
      const val = (this as any)[path];
      if (val !== null && val !== undefined) {
        (this as any)[path] = encryptField(val);
      }
    }
    next();
  });

  // Decrypt after a document is initialised from DB (covers all query types)
  schema.post('init', function (doc: any) {
    for (const { path, asType } of fields) {
      const val = doc[path];
      if (val !== undefined) {
        doc[path] = decryptField(val, asType);
      }
    }
  });

  // Encrypt update payloads for findOneAndUpdate / updateOne / updateMany
  schema.pre(
    ['findOneAndUpdate', 'updateOne', 'updateMany'] as any,
    function (next: () => void) {
      const update: any = (this as any).getUpdate();
      if (!update) return next();

      for (const { path } of fields) {
        // Handle { $set: { field: value } }
        if (update.$set?.[path] !== undefined) {
          update.$set[path] = encryptField(update.$set[path]);
        }
        // Handle { field: value } (Mongoose wraps these in $set internally, but guard both)
        if (update[path] !== undefined) {
          update[path] = encryptField(update[path]);
        }
      }
      next();
    },
  );

  // Decrypt result doc when findOneAndUpdate is called with { new: true }
  schema.post('findOneAndUpdate', function (doc: any) {
    if (!doc) return;
    for (const { path, asType } of fields) {
      const val = doc[path];
      if (val !== undefined) {
        doc[path] = decryptField(val, asType);
      }
    }
  });
}
