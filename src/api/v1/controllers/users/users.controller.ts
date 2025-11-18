import { Request, Response, NextFunction } from "express"
import { createUserService, type CreateUserInput } from "@services/users/users.service.js"
import { loginUserService, type LoginUserInput } from "@services/users/login.service.js"

export const createUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const payload: CreateUserInput = {
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        lastName: req.body.lastName,
        phone: req.body.phone,
        location: req.body.location,
        language: req.body.language,
        role: req.body.role,
        metadata: req.body.metadata,
    }

    const { user } = await createUserService(payload)

    res.status(201).json({
        message: "User created successfully",
        data: user,
    })
}

export const loginUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const payload: LoginUserInput = {
        email: req.body.email,
        password: req.body.password,
    }

    const { user, tokens } = await loginUserService(payload)

    res.status(200).json({
        message: "Login successful",
        data: {
            user,
            tokens,
        },
    })
}
