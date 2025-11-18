import { createUserService } from "@services/users/users.service.js";
import { loginUserService } from "@services/users/login.service.js";
export const createUserController = async (req, res, next) => {
    const payload = {
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        lastName: req.body.lastName,
        phone: req.body.phone,
        location: req.body.location,
        language: req.body.language,
        role: req.body.role,
        metadata: req.body.metadata,
    };
    const { user } = await createUserService(payload);
    res.status(201).json({
        message: "User created successfully",
        data: user,
    });
};
export const loginUserController = async (req, res, next) => {
    const payload = {
        email: req.body.email,
        password: req.body.password,
    };
    const { user, tokens } = await loginUserService(payload);
    res.status(200).json({
        message: "Login successful",
        data: {
            user,
            tokens,
        },
    });
};
