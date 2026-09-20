import { computeJob, transferables } from "./compute-job.js";
self.onmessage = ({ data: { id, job } }) => {
  try {
    const result = computeJob(job);
    self.postMessage({ id, result }, transferables(result));
  } catch (error) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};
