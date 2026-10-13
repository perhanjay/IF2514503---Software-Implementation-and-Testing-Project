import midtransClient from 'midtrans-client';
import dotenv from 'dotenv';

dotenv.config();

export const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DemoPolarisAudioKey123',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-DemoPolarisAudioKey123'
});

export const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-DemoPolarisAudioKey123',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-DemoPolarisAudioKey123'
});

export const TOKEN_PACKAGES = [
  { id: 'PKG-10', name: 'Paket Starter', tokens: 10, priceIdr: 25000, description: '10 Token untuk 10 kali perbaikan sesi audio' },
  { id: 'PKG-25', name: 'Paket Studio Pro', tokens: 25, priceIdr: 50000, description: '25 Token hemat untuk produksi multitrack studio' },
  { id: 'PKG-60', name: 'Paket Label Enterprise', tokens: 60, priceIdr: 100000, description: '60 Token kuota penuh untuk mixing engineer profesional' }
];
