package com.example.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        // triggered when receives SMS broadcast
        if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            for (SmsMessage sms : messages) {
                String sender = sms.getOriginatingAddress();
                String messageBody = sms.getMessageBody();

                Log.d(TAG, "🔥 SMS Intercepted: " + messageBody + " | From: " + sender);

                // HTTP POST
                new Thread(() -> sendToNodeServer(messageBody, sender)).start();
            }
        }
    }

    private void sendToNodeServer(String text, String sender) {
        try {
            // connects port 5000 of the Node.js
            URL url = new URL("http://10.0.2.2:5000/api/sms-webhook");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);

            // JSON body
            JSONObject jsonParam = new JSONObject();
            jsonParam.put("text", text);
            jsonParam.put("sender", sender);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonParam.toString().getBytes("utf-8");
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "🚀 HTTP POST Response Code: " + responseCode);
            conn.disconnect();

        } catch (Exception e) {
            Log.e(TAG, "❌ Error sending HTTP POST to Node.js server", e);
        }
    }
}