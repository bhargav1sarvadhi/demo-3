import express, { Express } from 'express';
import fileUpload from 'express-fileupload';
import './config/database';
import http, { request } from 'http';
import * as dotenv from 'dotenv';
dotenv.config();
import { logger } from './logger/logger';
import './config/passport.jwt';
import routes from './routes/index';
import passport from 'passport';
import cors from 'cors';
import session from 'express-session';
import { END_POINTS, MODEL } from './constant';
import i18n from './locales/index';
import { ErrorHandler } from './middleware';
import WebSocket from 'ws';
import * as UpstoxClient from 'upstox-js-sdk';
import protobuf from 'protobufjs';
import './utils/cron.job';
import { db } from './model';
import { Server } from 'socket.io';
import { INDEXES, USER_DETAILS } from './constant/response.types';
import { strategyController } from './controller';
import './config/restart.json';
import cron from 'node-cron';
import moment from 'moment';
import { debounce } from 'lodash';

let protobufRoot = null;
let defaultClient = UpstoxClient.ApiClient.instance;
let apiVersion = '2.0';
let OAUTH2 = defaultClient.authentications['OAUTH2'];
let updateBuffer = {};
// OAUTH2.accessToken = process.env.OAUTH2_ACCESS_TOKEN;

const port = process.env.PORT_SERVER || 8000;
const stocks = new Map<string, any>();

class AppServer {
    private io: Server;

    constructor() {
        const app: Express = express();
        const server = http.createServer(app);
        this.initWebSocket();
        const io = new Server(server, {
            cors: {
                origin: '*',
            },
        });
        this.io = io;
        this.io.on('connection', async (socket) => {
            // socket.emit('stock_data', stocks_data);
            socket.on('disconnect', () => {});
        });
        app.use(express.urlencoded({ extended: true }));
        app.use(express.json({}));
        app.use(
            fileUpload({
                limits: { fileSize: 1024 * 1024 * 1024 },
            }),
        );
        app.use(
            cors({
                origin: '*',
                credentials: true,
            }),
        );
        app.use(
            session({
                secret: process.env.SESSION_SECERET,
                resave: false,
                saveUninitialized: true,
            }),
        );
        app.use(i18n.init);
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(END_POINTS.MAIN, routes);
        app.use(ErrorHandler);
        server.listen(port, () => {
            logger.info(`🚀 Server is listening on Port:- ${port}`);
        });
    }

    async initWebSocket() {
        try {
            await this.initProtobuf();
            const wsUrl = await this.getMarketFeedUrl();
            const ws = await this.connectWebSocket(wsUrl);
            const Order_updated_urls = await this.getPortfolioFeedUrl();
            const ws2 = await this.connectorderUpdateWebSocket(
                Order_updated_urls,
            );
        } catch (error) {
            console.error('An error occurred:', error.message);
        }
    }

    async getMarketFeedUrl() {
        return new Promise<string>(async (resolve, reject) => {
            const user = await db[MODEL.USER].findOne({
                where: { email: USER_DETAILS.EMAIL },
            });
            OAUTH2.accessToken = user.token;
            if (OAUTH2.accessToken !== '') {
                let apiInstance = new UpstoxClient.WebsocketApi();
                apiInstance.getMarketDataFeedAuthorize(
                    apiVersion,
                    (error, data, response) => {
                        if (error) reject(error);
                        else resolve(data.data.authorizedRedirectUri);
                    },
                );
            }
        });
    }

    async getPortfolioFeedUrl() {
        return new Promise((resolve, reject) => {
            // Initialize a Websocket API instance
            let apiInstance = new UpstoxClient.WebsocketApi();

            // Request to get the portfolio stream feed authorization
            apiInstance.getPortfolioStreamFeedAuthorize(
                apiVersion,
                (error, data, response) => {
                    if (error) {
                        // If there's an error, log it and reject the promise
                        reject(error);
                    } else {
                        // If no error, log the returned data and resolve the promise
                        resolve(data.data.authorizedRedirectUri);
                    }
                },
            );
        });
    }

    initProtobuf = async () => {
        protobufRoot = await protobuf.load(__dirname + '/MarketDataFeed.proto');
        console.log('Protobuf part initialization complete');
    };
    decodeProfobuf = (buffer) => {
        if (!protobufRoot) {
            console.warn('Protobuf part not initialized yet!');
            return null;
        }

        const FeedResponse = protobufRoot.lookupType(
            'com.upstox.marketdatafeeder.rpc.proto.FeedResponse',
        );
        return FeedResponse.decode(buffer);
    };
    async connectWebSocket(wsUrl: string) {
        return new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'Api-Version': apiVersion,
                    Authorization: 'Bearer ' + OAUTH2.accessToken,
                },
                followRedirects: true,
            });

            ws.on('open', () => {
                console.log('connected');
                resolve(ws);
                setTimeout(async () => {
                    const options = await db[MODEL.HEDGING_OPTIONS].findAll({
                        attributes: ['id', 'instrument_key'],
                    });
                    const strikes = await db[MODEL.STRIKE_MODEL].findAll({
                        attributes: ['id', 'instrument_key'],
                    });
                    const instrumentKeys_stike = strikes.map(
                        (option) => option.instrument_key,
                    );
                    const instrumentKeys = options.map(
                        (option) => option.instrument_key,
                    );
                    const instrument_data_keys = [
                        ...instrumentKeys_stike,
                        ...instrumentKeys,
                    ];
                    console.log(instrument_data_keys.length);
                    const data = {
                        typr: '',
                        guid: 'someguid',
                        method: 'sub',
                        data: {
                            mode: 'ltpc',
                            instrumentKeys: instrument_data_keys,
                        },
                    };
                    ws.send(Buffer.from(JSON.stringify(data)));
                }, 1000);
            });
            ws.on('close', () => {
                console.log('disconnected');
            });

            ws.on('message', async (data) => {
                // console.log(JSON.stringify(this.decodeProfobuf(data)));
                const stocks_data: any = this.decodeProfobuf(data);
                strategyController.percentage_without_contions_strategy_with_live();
                const postions = async () => {
                    const postions = await db[MODEL.POSITION].findAll({
                        include: [
                            {
                                model: db[MODEL.TRADE],
                            },
                        ],
                        where: {
                            date: moment().format('YYYY-MM-DD'),
                        },
                        order: [['date', 'DESC']],
                    });
                    const totalPL = postions.reduce((sum, position) => {
                        return sum + position.pl;
                    }, 0);
                    // console.log('Total PL:', totalPL);
                    this.io.emit('stock_data', { postions, PL: totalPL });
                };
                postions();
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
        });
    }

    async connectorderUpdateWebSocket(wsUrl) {
        return new Promise((resolve, reject) => {
            // Initialize a WebSocket instance with the authorized URL and appropriate headers
            const ws2 = new WebSocket(wsUrl, {
                headers: {
                    'Api-Version': apiVersion,
                    Authorization: 'Bearer ' + OAUTH2.accessToken,
                },
                followRedirects: true,
            });

            // Set up WebSocket event handlers
            ws2.on('open', function open() {
                console.log('connected order updates');
                resolve(ws2); // Resolve the promise when the WebSocket is opened
            });

            ws2.on('close', function close() {
                console.log('disconnected');
            });

            ws2.on('message', async function message(data) {
                console.log('addd');
                // console.log('data received', JSON.parse(data.toString()));
                const update = JSON.parse(data.toString());
                // console.log(update);
                if (
                    update.update_type === 'order' &&
                    update.status === 'complete'
                ) {
                    setTimeout(async () => {
                        const find_data = await db[MODEL.TRADE].findOne({
                            where: {
                                upstock_order_id: update.order_id,
                            },
                        });
                        if (find_data) {
                            let fillter = {};
                            if (find_data.buy_status) {
                                fillter = {
                                    buy_status: false,
                                    buy_price: update.average_price,
                                    stop_loss: update.average_price * 2,
                                };
                            }
                            if (find_data.sell_status) {
                                fillter = {
                                    sell_status: false,
                                    sell_price: update.average_price,
                                };
                            }
                            const update_trade_details = await db[
                                MODEL.TRADE
                            ].update(
                                { ...fillter },
                                {
                                    where: {
                                        id: find_data.id,
                                    },
                                },
                            );
                        }
                        console.log(find_data?.id, update.status);
                    }, 1000);
                }
            });

            ws2.on('error', function onError(error) {
                console.log('error:', error);
                reject(error); // Reject the promise when there's an error
            });
        });
    }
}
new AppServer();
