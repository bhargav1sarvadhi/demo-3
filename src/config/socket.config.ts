import { MODEL, ROLES } from '../constant';
import { db } from '../model';
import { Op, Sequelize } from 'sequelize';
import { TokenController } from '../config/passport.jwt';
import { logger } from '../logger/logger';

class SocketManager {
    io: any;
    server: any;
    chat_open_status: Map<any, any>;

    constructor(server) {
        this.io = null;
        this.chat_open_status = new Map();
        this.server = server;
        this.initializeSocket(this.server);
    }

    initializeSocket(server) {
        try {
            this.io = server;
            this.setPostionsEvent();
        } catch (error) {
            logger.error('Error initializing Socket.IO:', error);
        }
    }
    setPostionsEvent() {
        this.io.on('connection', async (socket) => {
            const { user } = socket;

            socket.on('send_message', async (data) => {});

            socket.on('disconnect', () => {});
        });
    }
}

export default SocketManager;
