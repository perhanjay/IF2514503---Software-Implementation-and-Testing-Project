import { WorkbenchService } from '../services/workbenchService.js';

function handleError(res, err, fallbackMsg) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    console.error('[Workbench Error]', err);
  }
  return res.status(status).json({ error: err.message || fallbackMsg });
}

export class WorkbenchController {
  static async separate(req, res) {
    try {
      const result = await WorkbenchService.startSeparation(req.user.id, req.file);
      return res.status(202).json(result);
    } catch (err) {
      return handleError(res, err, 'Gagal memulai pemisahan stem audio');
    }
  }

  static async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const result = await WorkbenchService.getJobStatus(jobId, req.user.id);
      return res.status(200).json(result);
    } catch (err) {
      return handleError(res, err, 'Gagal memuat status pekerjaan workbench');
    }
  }

  static async split(req, res) {
    try {
      const { jobId, stemName, regions, fadeMs } = req.body || {};
      const result = await WorkbenchService.splitAudio({
        userId: req.user.id,
        file: req.file,
        jobId,
        stemName,
        regions,
        fadeMs
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleError(res, err, 'Gagal memecah segmen audio');
    }
  }

  static async downloadSplitZip(req, res) {
    try {
      const { splitId } = req.params;
      const { format } = req.query || {};
      const { filename, buffer } = await WorkbenchService.downloadSplitZip(splitId, req.user.id, format);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      return handleError(res, err, 'Gagal mengunduh arsip ZIP aset audio');
    }
  }

  static async downloadZip(req, res) {
    try {
      const { jobId } = req.params;
      const { format } = req.query || {};
      const { filename, buffer } = await WorkbenchService.downloadJobZip(jobId, req.user.id, format);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      return handleError(res, err, 'Gagal mengunduh arsip ZIP stem');
    }
  }

  static async downloadStem(req, res) {
    try {
      const { jobId, stemName } = req.params;
      const { format } = req.query || {};
      const { filename, mimeType, buffer } = await WorkbenchService.downloadJobStem(
        jobId,
        req.user.id,
        stemName,
        format
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      return handleError(res, err, 'Gagal mengunduh stem audio');
    }
  }

  static async exportObject(req, res) {
    try {
      const { storageKey, format, sourceTargetFormat, sourceBitrateKbps, fileName } = req.query || {};
      const { filename, mimeType, buffer } = await WorkbenchService.exportStorageObject(req.user.id, {
        storageKey,
        format,
        sourceTargetFormat,
        sourceBitrateKbps,
        fileName
      });
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err) {
      return handleError(res, err, 'Gagal mengekspor berkas audio');
    }
  }

  static async sendToSession(req, res) {
    try {
      const { jobId } = req.params;
      const { title, stemNames } = req.body || {};
      const result = await WorkbenchService.sendJobToSession(jobId, req.user.id, {
        title,
        stemNames
      });
      return res.status(201).json(result);
    } catch (err) {
      return handleError(res, err, 'Gagal mengirim stem ke Studio Workspace');
    }
  }
}
