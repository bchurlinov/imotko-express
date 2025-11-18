import authRouter from "./auth/auth.routes.js";
import propertiesRouter from "./properties/properties.routes.js";
import usersRouter from "./users/users.routes.js";
export default (app) => {
    app.use("/api/v1/auth", authRouter);
    app.use("/api/v1/properties", propertiesRouter);
    app.use("/api/v1/users", usersRouter);
};
