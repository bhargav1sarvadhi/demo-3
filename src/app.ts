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
const TOKEN =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6WyJWaWV3Il0sImV4cCI6MTcyMjc5NjIwMCwianRpIjoiZDAwODc3NjMtYTdkMy00YTUxLWEwY2YtNDYwNjVjZGE2YjJiIiwiaWF0IjoxNzIyNzU4MzQ1LCJpc3MiOiJsb2dpbi1zZXJ2aWNlIiwic3ViIjoiMmIyMDA2YmItOTMyYy00MDVjLWJkMjItZmY5YzlhYzUwZGE3IiwidWNjIjoiWEJIMTIiLCJuYXAiOiIiLCJ5Y2UiOiJlWVxcNlwiLSQ1IXdcdTAwMDFcblx1MDAwNmRcdTAwMDBcdTAwMTBiIiwiZmV0Y2hjYWNoaW5ncnVsZSI6MCwiY2F0ZWdvcmlzYXRpb24iOiIifQ.fxyQBqxW4kZBe9PHRKtgry6OKguBew6k5HyiChL21wE91408c6UL5bG3YNaomFnrV2nPjcCRc_uigsuzpadcgmBhNmIYp59fMRg8fRzlrO4BjXu1yeUeaBEtW9yvZmBFpFJxu-IYslLnYy19wkR70Nf0hZBG4Lg0HJ59q7Hh7JrrTFQHfzxmz8OM2dpo8Y6993XO_NrPU9RRGWf0cq0WBkasFP1hNGjfbkTjJLJBZBBYMDsirdNvJqPLrlOxz67edNXebCDYBxsDoLYJByN8FusaH_EvsYP1zihHyPF680uFEGMwbuFo3sELuzVkH7nYi3vxlg3e1n-vIJuIk90cAg';
const SID = 'b551f6df-34ab-4483-b8dc-977ac40f55ff';
const handshakeServerId = 'server3';
// OAUTH2.accessToken = process.env.OAUTH2_ACCESS_TOKEN;

const port = process.env.PORT_SERVER || 8000;
const stocks = new Map<string, any>();

class AppServer {
    private io: Server;

    constructor() {
        const app: Express = express();
        const server = http.createServer(app);
        // this.initWebSocket();
        this.initKotakWebSocket();
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
        } catch (error) {
            console.error('An error occurred:', error.message);
        }
    }
    async initKotakWebSocket() {
        try {
            const url = `wss://mlhsi.kotaksecurities.com/realtime?sId=${handshakeServerId}`;
            const ws = new WebSocket(url);
            ws.on('open', () => {
                console.log('Connected to WebSocket server');

                const hsijObj = {
                    type: 'cn',
                    Authorization:
                        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6WyJUcmFkZSJdLCJleHAiOjE3MjI3OTYyMDAsImp0aSI6IjA5NjZiYTQ2LWEyYTgtNDk2Mi04ODE2LTgzODQ2Njk1MGM1OCIsImlhdCI6MTcyMjc2MjUwNywiaXNzIjoibG9naW4tc2VydmljZSIsInN1YiI6IjJiMjAwNmJiLTkzMmMtNDA1Yy1iZDIyLWZmOWM5YWM1MGRhNyIsInVjYyI6IlhCSDEyIiwibmFwIjoiIiwieWNlIjoiZVlcXDZcIi0kNSF3XHUwMDAxXG5cdTAwMDZkXHUwMDAwXHUwMDEwYiIsImZldGNoY2FjaGluZ3J1bGUiOjAsImNhdGVnb3Jpc2F0aW9uIjoiIn0.DZdOZOXc7xWWqStKGhUM_2BrJ-L0e744EHEyLob4ielxscO5j11YVUpd3X2epIW861wrrVALAnjleRQv6RwgtKQdu7Wo_bKtjTL_OhYEKYPh6aLW5CD-F8jqLTLDBDsYgmxn3zOwWNINU5XHfEv4QxHqhxSHyuckmZWlSMl1aZTOUkBahxQq4BMyHHRPye7B4-nxYT-jWxbI-LQHagM6RKR2tH-cz-dctA5R4FahV4yUAxwVbnkXk-HxX7fh5UAzUC5lSke6yZlsGKD9-ilUY8Ute4iSGfUHQxot4dH-6yfNrYIayDVOvWRlgcv3ct_g6D6TvlJpOf9lOKxBdLxRRw',
                    Sid: '470c125b-0e4b-4a93-863e-60f138a43397',
                    source: 'WEB',
                };

                console.log('Sending connection request:', hsijObj);
                ws.send(JSON.stringify(hsijObj));
            });
            ws.on('message', (data) => {
                const result = JSON.parse(data);
                console.log('Message received:', result);
            });
            ws.on('close', () => {
                console.log('Connection closed');
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
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
                strategyController.percentage_strategy();
                strategyController.percentage_without_contions_strategy();
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
}
new AppServer();
