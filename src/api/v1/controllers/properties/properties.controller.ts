import { Request, Response, NextFunction } from "express"
import { getProperties } from "@services/properties/properties.service.js"

export const getPropertiesController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    try {
        const properties = await getProperties(req.query)
        return res.status(200).json(properties)
    } catch (error) {
        console.error("Error fetching properties:", error)
        next(error)
    }
}
