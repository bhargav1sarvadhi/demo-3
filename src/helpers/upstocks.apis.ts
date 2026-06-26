import S3 from 'aws-sdk/clients/s3';
import { config } from 'dotenv';
import { ERRORTYPES, RES_TYPES } from '../constant';
import { logger } from '../logger/logger';
import axios from 'axios';
import { AppError } from '../utils';

export const place_order_on_upstocks = async (data) => {
    try {
        console.log(data);
        const url = 'https://api-hft.upstox.com/v3/order/place';
        const accessToken = data.accessToken; // Replace with your valid token
        const payload = {
            quantity: data.quantity,
            product: 'D',
            validity: 'DAY',
            price: 0,
            tag: 'place order', // Optional: you can customize this
            instrument_token: data.instrument_key,
            order_type: 'MARKET',
            transaction_type: data.transaction_type,
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false,
            slice: false,
            market_protection: 0,
        };
        console.log(accessToken);
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
        console.log(response);
        console.log('✅ Order placed successfully:', response.data);
        return response.data;
    } catch (error) {
        logger.error('Error in place_order_on_upstocks', error);
    }
};
