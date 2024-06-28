import express, { Express } from 'express';
import fileUpload from 'express-fileupload';
import './config/database';
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

let protobufRoot = null;
let defaultClient = UpstoxClient.ApiClient.instance;
let apiVersion = '2.0';
let OAUTH2 = defaultClient.authentications['OAUTH2'];
OAUTH2.accessToken = process.env.OAUTH2_ACCESS_TOKEN;

const port = process.env.PORT_SERVER || 8000;

class AppServer {
    constructor() {
        const app: Express = express();
        this.initWebSocket();
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
        app.listen(port, () => {
            logger.info(`🚀 Server is listening on Port:- ${port}`);
        });
    }

    async initWebSocket() {
        try {
            await this.initProtobuf();
            const wsUrl = await this.getMarketFeedUrl();
            const ws = await this.connectWebSocket(wsUrl);
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    async getMarketFeedUrl() {
        return new Promise<string>((resolve, reject) => {
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

                setTimeout(() => {
                    const data = {
                        typr: '',
                        guid: 'someguid',
                        method: 'sub',
                        data: {
                            mode: 'ltpc',
                            instrumentKeys: [
                                'NSE_INDEX|Nifty 50',
                                'NSE_FO|67509',
                            ],
                        },
                    };
                    ws.send(Buffer.from(JSON.stringify(data)));
                }, 1000);
            });

            ws.on('close', () => {
                console.log('disconnected');
            });

            ws.on('message', (data) => {
                console.log(JSON.stringify(this.decodeProfobuf(data)));
                const stocks_data: any = this.decodeProfobuf(data);
                if (stocks_data && stocks_data.feeds) {
                    for (const key in stocks_data.feeds) {
                        if (stocks_data.feeds.hasOwnProperty(key)) {
                            const instrument_key = stocks_data.feeds[key];
                            // console.log(instrument_key);
                            // const marketOHLCData =
                            //     instrument_key?.ff?.marketFF?.marketOHLC;
                            // if (marketOHLCData) {
                            //     marketOHLCData.ohlc.forEach(
                            //         async (ohlcData) => {
                            //             await db[MODEL.CANDELS].create({
                            //                 instrument_key: key,
                            //                 interval: ohlcData.interval,
                            //                 open: ohlcData.open,
                            //                 high: ohlcData.high,
                            //                 low: ohlcData.low,
                            //                 close: ohlcData.close,
                            //                 volume: ohlcData.volume,
                            //                 ts: `${ohlcData.ts}`,
                            //             });
                            //         },
                            //     );
                            // } else {
                            //     // console.log(
                            //     //     `No market OHLC data available for ${key}`,
                            //     // );
                            // }
                        }
                    }
                } else {
                    console.log('No feeds data available');
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
        });
    }
}
new AppServer();