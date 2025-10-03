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
import { db } from './model';
import { Server } from 'socket.io';
import { INDEXES, USER_DETAILS } from './constant/response.types';
import { strategyController } from './controller';
import './config/restart.json';
import cron from 'node-cron';
import moment from 'moment';
import { debounce } from 'lodash';
import { Op } from 'sequelize';
import axios from 'axios';
import './utils/cron.job';

let protobufRoot = null;
let defaultClient = UpstoxClient.ApiClient.instance;
let apiVersion = '3.0';
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
            path: '/api/socket',
        });
        this.io = io;
        this.io.on('connection', async (socket) => {
            // socket.emit('stock_data', stocks_data);
            socket.on('sendemit', (data) => {
                console.log(data);
                this.io.emit('stock_data', data);
            });
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
        } catch (error) {
            console.error('An error occurred:', error.message);
        }
    }

    async getMarketFeedUrl() {
        try {
            const user = await db[MODEL.USER].findOne({
                where: { email: USER_DETAILS.EMAIL },
            });

            if (!user || !user.token) {
                throw new Error('User token not found');
            }

            const url =
                'https://api.upstox.com/v3/feed/market-data-feed/authorize';

            const response = await axios.get(url, {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${user.token}`,
                },
            });

            return response.data.data.authorizedRedirectUri;
        } catch (error) {
            console.error('Error in getMarketFeedUrl:', error.message || error);
            throw error;
        }
    }

    initProtobuf = async () => {
        protobufRoot = await protobuf.load(
            __dirname + '/MarketDataFeedV3.proto',
        );
        console.log('Protobuf part initialization complete');
    };
    decodeProfobuf = (buffer) => {
        if (!protobufRoot) {
            console.warn('Protobuf part not initialized yet!');
            return null;
        }

        const FeedResponse = protobufRoot.lookupType(
            'com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse',
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
                    const startDate = moment()
                        .startOf('month')
                        .format('YYYY-MM-DD');
                    const endDate = moment()
                        .endOf('month')
                        .format('YYYY-MM-DD');
                    const options = await db[MODEL.OPTIONS_CHAINS].findAll({
                        attributes: ['id', 'instrument_key'],
                        where: {
                            expiry: {
                                [Op.between]: [startDate, endDate],
                            },
                            is_active: true,
                        },
                    });

                    const strikes = await db[MODEL.INSTRUMENT].findAll({
                        where: {
                            instrument_key: 'NSE_EQ|INE062A01020',
                        },
                        attributes: ['id', 'instrument_key'],
                    });

                    const instrumentKeys_stike = strikes.map(
                        (option) => option.instrument_key,
                    );
                    const instrumentKeys = options.map(
                        (option) => option.instrument_key,
                    );
                    const instrument_data_keys = ['NSE_FO|57735'];
                    console.log(instrument_data_keys.length);
                    const data = {
                        typr: '',
                        guid: 'someguid',
                        method: 'sub',
                        data: {
                            mode: 'full',
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
                // console.log(JSON.stringify(data));
                const stocks_data: any = this.decodeProfobuf(data);

                // console.log(stocks_data);
                if (stocks_data && stocks_data.feeds) {
                    for (const key in stocks_data.feeds) {
                        if (stocks_data.feeds.hasOwnProperty(key)) {
                            const feedData =
                                stocks_data.feeds[key]?.fullFeed?.marketFF;
                            if (feedData?.marketOHLC?.ohlc?.length) {
                                const i1Candle = feedData.marketOHLC.ohlc.find(
                                    (c) => c.interval === 'I1',
                                );
                                if (i1Candle) {
                                    // console.log('1-min Candle:', i1Candle);
                                    const timestamp = i1Candle.ts.toNumber();
                                    const volume = i1Candle.vol.toNumber();
                                    const candleDate = new Date(timestamp);
                                    const candleDateIST =
                                        candleDate.toLocaleString('en-IN', {
                                            timeZone: 'Asia/Kolkata',
                                        });
                                    const [find, created] = await db[
                                        MODEL.CANDELS
                                    ].findOrCreate({
                                        where: {
                                            ts: timestamp.toString(),
                                            instrument_key: key,
                                        },
                                        defaults: {
                                            ts: timestamp.toString(),
                                            open: i1Candle.open,
                                            high: i1Candle.high,
                                            low: i1Candle.low,
                                            close: i1Candle.close,
                                            volume: volume,
                                            instrument_key: key,
                                            interval: i1Candle.interval,
                                        },
                                    });
                                    if (find) {
                                        const updated = await db[
                                            MODEL.CANDELS
                                        ].update(
                                            {
                                                open: i1Candle.open,
                                                high: i1Candle.high,
                                                low: i1Candle.low,
                                                close: i1Candle.close,
                                                volume: volume,
                                            },
                                            { where: { id: find.id } },
                                        );
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.log('No feeds data available');
                }
                // strategyController.percentage_strategy();
                // strategyController.sbin_timing_strategy();
                // strategyController.percentage_without_contions_strategy();
                // const postions = async () => {
                //     const postions = await db[MODEL.POSITION].findAll({
                //         include: [
                //             {
                //                 model: db[MODEL.TRADE],
                //             },
                //         ],
                //         where: {
                //             date: moment().format('YYYY-MM-DD'),
                //         },
                //         order: [
                //             ['start_time', 'ASC'],
                //             ['date', 'DESC'],
                //         ],
                //     });
                //     const totalPL = postions.reduce((sum, position) => {
                //         return sum + position.pl;
                //     }, 0);
                //     // console.log('Total PL:', totalPL);
                //     this.io.emit('stock_data', { postions, totalPL: totalPL });
                // };
                // postions();
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
        });
    }
}
new AppServer();
