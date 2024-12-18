import express from "express"
import {
    loginUserController,
    registerUserController,
    logoutUserController,
    refreshTokenController,
} from "#controllers/user/auth/auth.controller.js"
import { check } from "express-validator"

const router = express.Router()

router.post(
    "/login",
    [
        check("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
        check("password").notEmpty().withMessage("Password is required"),
    ],
    loginUserController
)
router.post(
    "/register",
    [
        check("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
        check("name").notEmpty().withMessage("Name is required").isString().withMessage("Invalid name"),
        check("password").notEmpty().isString().withMessage("Password is required"),
        check("location").notEmpty().isString().withMessage("Location is required"),
        check("language")
            .notEmpty()
            .withMessage("Language is required")
            .isString()
            .withMessage("Language must be a string")
            .isIn(["MK", "AL", "EN"])
            .withMessage("Language must be one of the following: MK, AL, EN"),
    ],
    registerUserController
)
router.get("/logout", logoutUserController)
router.get("/refresh", refreshTokenController)

export default router
