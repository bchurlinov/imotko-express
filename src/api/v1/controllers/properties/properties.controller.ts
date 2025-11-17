import { Request, Response } from "express"
import { getProperties } from "@services/properties/properties.service.js"

export const listPropertiesController = async (req: Request, res: Response): Promise<any> => {
    const properties = await getProperties(req.query)
    return res.status(200).json(properties)
}
