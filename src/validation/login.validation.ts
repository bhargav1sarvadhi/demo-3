import Joi from 'joi';
import { validateReq } from '../helpers/validation.helper';
import { CommonValidationFilter } from '../helpers/validation.helper';

export const loginValidation = (req, res, next) => {
    const loginSchema = Joi.object({
        phone: Joi.string().required().messages({
            'string.empty': 'Phone cannot be an empty string.',
            'string.required': 'Phone is required.',
        }),
        password: new CommonValidationFilter().password(),
    });
    validateReq(req, next, loginSchema);
};
