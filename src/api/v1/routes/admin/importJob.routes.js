import express from "express";
import {
    getImportHistory,
    getExecutionDetails,
    getLastExecution,
    triggerImport,
    getCurrentStatus,
    getStatistics,
} from "../../controllers/admin/importJob.controller.js";

const router = express.Router();

/**
 * Admin routes for property import job management
 * Task 7.2.5: Admin endpoints to view import history
 * Task 7.1.6: Manual trigger capability
 *
 * All routes should be protected with admin authentication middleware
 */

// Get import history with pagination and filters
// GET /api/v1/admin/import-jobs/history?limit=50&offset=0&status=SUCCESS&triggeredBy=cron
router.get("/history", getImportHistory);

// Get execution statistics
// GET /api/v1/admin/import-jobs/statistics?days=30
router.get("/statistics", getStatistics);

// Get last execution
// GET /api/v1/admin/import-jobs/last
router.get("/last", getLastExecution);

// Get current job status
// GET /api/v1/admin/import-jobs/status
router.get("/status", getCurrentStatus);

// Get execution details by ID
// GET /api/v1/admin/import-jobs/:executionId
router.get("/:executionId", getExecutionDetails);

// Manually trigger import job
// POST /api/v1/admin/import-jobs/trigger
router.post("/trigger", triggerImport);

export default router;
