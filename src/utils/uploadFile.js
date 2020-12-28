import Busboy from 'busboy';
import path from 'path';
import { uploadFile } from '../..';

export default ({
  model: Model,
  provider,
  headers,
  stream,
  uploadsFolder,
  allowedFormats,
  fullPrefix,
}) => new Promise((resolve, reject) => {
  let isFileDetected = false;

  const busboy = new Busboy({ headers });
  const data = {};
  busboy.on('field', (fieldname, val) => {
    data[fieldname] = val;
  });

  busboy.on('file', async (fieldname, fileStream, filename) => {
    isFileDetected = true;

    if (allowedFormats !== '*' && !allowedFormats.includes(path.extname(filename).substring(1).toLowerCase())) {
      reject(new Error('File format is not allowed'));
    }

    try {
      const filePath = await uploadFile({ stream: fileStream, filename, uploadsFolder });

      const { id } = Model ? await new Model({
        path: filePath.replace(uploadsFolder, ''),
        type: path.extname(filePath),
        name: filename,
        transformedImages: [],
        ...Object.assign({}, ...Object.entries(data).map(([key, value]) => ({ [key]: value }))),
      }).save()
        : await provider.create({
          path: filePath.replace(uploadsFolder, ''),
          name: filename,
          type: path.extname(filePath),
          transformedImages: [],
          ...Object.assign({}, ...Object.entries(data).map(([key, value]) => ({ [key]: value }))),
        });

      const url = `${fullPrefix}/${id}`;

      if (Model) {
        await Model.updateOne({ _id: id }, { $set: { url } });
      } else {
        await provider.update({ id, url, transformedImages: [] });
      }

      resolve({
        id, name: filename, type: path.extname(filePath), url,
      });
    } catch (err) {
      reject(err);
    }
  });

  busboy.on('finish', () => {
    if (!isFileDetected) {
      reject(new Error('No file uploaded'));
    }
  });

  stream.pipe(busboy);
});
