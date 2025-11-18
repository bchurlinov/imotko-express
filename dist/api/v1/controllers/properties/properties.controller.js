import { getProperties } from "@services/properties/properties.service.js";
export const getPropertiesController = async (req, res, next) => {
    try {
        console.log(req);
        const properties = await getProperties(req.query);
        return res.status(200).json(properties);
    }
    catch (error) {
        console.error("Error fetching properties:", error);
        next(error);
    }
};
