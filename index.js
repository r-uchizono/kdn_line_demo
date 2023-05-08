// -----------------------------------------------------------------------------
// モジュールのインポート
import express from 'express'; 
import { Client, middleware } from "@line/bot-sdk"; // Messaging APIのSDKをインポート
import fs from 'fs';
import pg from 'pg';
import QRCode from 'qrcode'; 
import getRandomValues from 'get-random-values';
import path from 'path';
import { fileURLToPath } from 'url';
import Chart from 'chart.js/auto';
import jsdom from 'jsdom';


// -----------------------------------------------------------------------------
// パラメータ設定
const line_config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN, // 環境変数からアクセストークンをセットしています
    channelSecret: process.env.LINE_CHANNEL_SECRET // 環境変数からChannel Secretをセットしています
};

// -----------------------------------------------------------------------------
// Webサーバー設定
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageDir = path.join(__dirname, 'public');
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir);
}
app.use(express.static(imageDir));

// APIコールのためのクライアントインスタンスを作成
const bot = new Client(line_config);
const client = new pg.Pool({
    user: 'unis',
    host: 'dpg-cgvn4qodh87joksvpj70-a',
    database: 'event_f91d',
    password: 'gbFeZ4j0o2mXOlCdCw0qF4TMaYTkldcn',
    port: 5432
});

app.post("/", (req, res)=> {
    app.render('index.js');
})

app.listen(process.env.PORT || 3000);

// -----------------------------------------------------------------------------
// ルーター設定
app.post('/bot/webhook', middleware(line_config), (req, res, next) => {
    // 先行してLINE側にステータスコード200でレスポンスする。
    res.sendStatus(200);

    // すべてのイベント処理のプロミスを格納する配列。
     let events_processed = [];

    req.body.events.forEach((event) => {
        // この処理の対象をイベントタイプがメッセージで、かつ、テキストタイプだった場合に限定。
        if (event.type == "message" && event.message.type == "text"){
            // ユーザーからのテキストメッセージが「イベント一覧」だった場合のみ反応。
            if (event.message.text == "イベント一覧"){
                //データを取りだす
                let bufferData = fs.readFileSync('yoyaku.json')
                // データを文字列に変換
                let dataJSON = bufferData.toString()
                //JSONのデータをJavascriptのオブジェクトに
                let data = JSON.parse(dataJSON)
                let data_message = [];
                data[0].contents.contents = [];

                let query_event_base = {
                    text: "SELECT *" +
                          "  FROM m_event_base t1 " +
                          " WHERE current_date BETWEEN t1.start_ymd AND t1.end_ymd" +
                          "    OR current_date < t1.start_ymd" +
                          " ORDER BY t1.start_ymd",
                };

                client.connect(function (err, client) {
                    if (err) {
                      console.log(err);
                    } else {
                      client
                        .query(query_event_base)
                        .then((res) => {
                            console.log(res.rows[0].event_cd);
                            const query_event = {
                                text: "SELECT e1.*" +
                                      "     , k.kaisaiti_nm" +
                                      "     , t1.id as t1_id" +
                                      "     , t2.id as t2_id" +
                                      "  FROM m_event e1" +
                                      " INNER JOIN m_kaisaiti k" +
                                      "    ON e1.kaisaiti_cd = k.kaisaiti_cd" +
                                      "  LEFT OUTER JOIN" +
                                      "       t_yoyaku t1" +
                                      "    ON e1.event_cd = t1.event_cd" +
                                      "   AND e1.kaisaiti_cd = t1.kaisaiti_cd" +
                                      "   AND e1.first_day = date_trunc('day',t1.reserve_time)" +
                                      "   AND t1.user_id = $1" +
                                      "  LEFT OUTER JOIN" +
                                      "       t_yoyaku t2" +
                                      "    ON e1.event_cd = t2.event_cd" +
                                      "   AND e1.kaisaiti_cd = t2.kaisaiti_cd" +
                                      "   AND e1.second_day = date_trunc('day',t2.reserve_time)" +
                                      "   AND t2.user_id = $1" +
                                      " WHERE e1.event_cd = $2" + 
                                      " ORDER BY e1.first_day",
                                values:[event.source.userId, res.rows[0].event_cd],
                            };  
                            let event_nm = res.rows[0].event_nm

                            client.query(query_event)
                            .then((res) => {

                                let end = 0;
                                let start = 0;

                                let row =  Math.ceil(res.rows.length/6);
                                console.log(row);

                                for(let I = 0; I < row; I++){
                                    console.log("roop start");
                                    if(res.rows.length <= 6)
                                    {
                                        end = res.rows.length
                                    }
                                    else 
                                    { 
                                        if(res.rows.length - end > 6){
                                            end = (I + 1)*6;
                                        }
                                        else{
                                            end = res.rows.length
                                        }
                                        
                                        start = (I)*6
                                    }

                                    for(let i = start; i < end; i++){

                                        let f_stime = new Date('2023-04-01T' + res.rows[i].first_start_time);
                                        let f_etime = new Date('2023-04-01T' + res.rows[i].first_end_time);
                                        let s_stime = new Date('2023-04-01T' + res.rows[i].second_start_time);
                                        let s_etime = new Date('2023-04-01T' + res.rows[i].second_end_time);
                                        let F_SformattedTime = f_stime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric'}); // ロケールに基づいた形式の時間に変換する
                                        let F_EformattedTime = f_etime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric'});
                                        let S_SformattedTime = s_stime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric'}); // ロケールに基づいた形式の時間に変換する
                                        let S_EformattedTime = s_etime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: 'numeric'});
                                        
                                        let f_date = new Date(res.rows[i].first_day);
                                        let f_year = f_date.getFullYear();
                                        let f_month = ('0' + (f_date.getMonth() + 1)).slice(-2);
                                        let f_day = ('0' + f_date.getDate()).slice(-2);
                                        let f_dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][f_date.getDay()];
                                        let f_formattedDate = `${f_year}年${f_month}月${f_day}日（${f_dayOfWeek}）`;
                                        let f_dataDate = `${f_year}/${f_month}/${f_day}`;

                                        let firstEventJson = JSON.parse(dataJSON)[0].contents.contents[0];
                                        firstEventJson.header.contents[0].text = event_nm + '/' + res.rows[i].kaisaiti_nm + '会場';
                                        firstEventJson.body.contents[0].text = f_formattedDate;
                                        firstEventJson.body.contents[1].text = '開催時間　' + F_SformattedTime + '～' + F_EformattedTime;
                                        firstEventJson.body.contents[2].text = '場所　' + res.rows[i].place_name;
                                        let address = res.rows[i].place_address;
                                        firstEventJson.body.contents[3].action.label = address;
                                        firstEventJson.body.contents[3].action.uri = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
                                        if(res.rows[i].t1_id != null){
                                            firstEventJson.footer.contents = [];
                                            firstEventJson.footer.contents[0] = {
                                            "type": "button",
                                            "action": {
                                              "type": "postback",
                                              "label": "予約済みです",
                                              "data": "dummy"
                                            }   
                                            };
                                        }
                                        else{
                                            firstEventJson.footer.contents[0].action.data = 'event_id=' + res.rows[i].event_cd + '=' + res.rows[i].kaisaiti_cd + '=' + f_dataDate;
                                        }

                                        data[0].contents.contents.push({...firstEventJson});

                                        if(res.rows[i].second_day != null)
                                        {
                                            let s_date = new Date(res.rows[i].second_day);
                                            let s_year = s_date.getFullYear();
                                            let s_month = ('0' + (s_date.getMonth() + 1)).slice(-2);
                                            let s_day = ('0' + s_date.getDate()).slice(-2);
                                            let s_dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][s_date.getDay()];
                                            let s_formattedDate = `${s_year}年${s_month}月${s_day}日（${s_dayOfWeek}）`;
                                            let s_dataDate = `${s_year}/${s_month}/${s_day}`;

                                            let secondEventJson = JSON.parse(dataJSON)[0].contents.contents[0];
                                            secondEventJson.header.contents[0].text = event_nm + '/' + res.rows[i].kaisaiti_nm + '会場';
                                            secondEventJson.body.contents[0].text = s_formattedDate;
                                            secondEventJson.body.contents[1].text = '開催時間　' + S_SformattedTime + '～' + S_EformattedTime;
                                            secondEventJson.body.contents[2].text = '場所　' + res.rows[i].place_name;
                                            secondEventJson.body.contents[3].action.label = address;
                                            secondEventJson.body.contents[3].action.uri = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);                                           
                                            if(res.rows[i].t2_id != null){
                                                secondEventJson.footer.contents = [];
                                                secondEventJson.footer.contents[0] = {
                                                "type": "button",
                                                "action": {
                                                  "type": "postback",
                                                  "label": "予約済みです",
                                                  "data": "dummy"
                                                }   
                                                };
                                            }
                                            else{
                                                secondEventJson.footer.contents[0].action.data = 'event_id=' + res.rows[i].event_cd + '=' + res.rows[i].kaisaiti_cd + '=' + s_dataDate;
                                            }
                                            data[0].contents.contents.push({...secondEventJson});
                                        }
                                    }

                                    data_message.push({...data[0]});
                                    data = JSON.parse(dataJSON)
                                    data[0].contents.contents = [];
                                }
                                // replyMessage()で返信し、そのプロミスをevents_processedに追加。
                                events_processed.push(bot.replyMessage(event.replyToken, data_message));


                               
                                // const { JSDOM } = jsdom;

                                // const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
                                // const document = dom.window.document;
                             
                                const ctx = document.getElementById('myChart');

                                const chart = new Chart(ctx, {
                                    type: 'bar',
                                    data: {
                                        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
                                        datasets: [{
                                            label: '# of Votes',
                                            data: [12, 19, 3, 5, 2, 3],
                                            backgroundColor: [
                                                'rgba(255, 99, 132, 0.2)',
                                                'rgba(54, 162, 235, 0.2)',
                                                'rgba(255, 206, 86, 0.2)',
                                                'rgba(75, 192, 192, 0.2)',
                                                'rgba(153, 102, 255, 0.2)',
                                                'rgba(255, 159, 64, 0.2)'
                                            ],
                                            borderColor: [
                                                'rgba(255, 99, 132, 1)',
                                                'rgba(54, 162, 235, 1)',
                                                'rgba(255, 206, 86, 1)',
                                                'rgba(75, 192, 192, 1)',
                                                'rgba(153, 102, 255, 1)',
                                                'rgba(255, 159, 64, 1)'
                                            ],
                                            borderWidth: 1
                                        }]
                                    }
                                })

                                console.log(chart)
                                
                                

                                
                                                    
                            })
                            
                        })
                    }
                })
            }
            // ユーザーからのテキストメッセージが「予約確認」だった場合のみ反応。
            else if (event.message.text == "予約確認"){
                //データを取りだす
                const bufferData = fs.readFileSync('kakunin.json')
                // データを文字列に変換
                const dataJSON = bufferData.toString()
                //JSONのデータをJavascriptのオブジェクトに
                const data = JSON.parse(dataJSON)
                //data.contents.header.contents[0].text = '鹿児島会場'
                // replyMessage()で返信し、そのプロミスをevents_processedに追加。
                events_processed.push(bot.replyMessage(event.replyToken, data));
            }
            // ユーザーからのテキストメッセージが「会員ID」だった場合のみ反応。
            else if (event.message.text == "会員ID") {                  
                //画像ファイル名としてランダムな文字列作成
                let S="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                let array = new Uint8Array(16);
                let QRfile = Array.from(getRandomValues(array)).map((n)=>S[n%S.length]).join('')
                console.log(getRandomValues(array));

                const query = {
                    text: "SELECT user_id FROM m_user WHERE user_id = $1",
                    values:[event.source.userId],
                };

                let userid;
                client.connect(function (err, client) {
                    if (err) {
                      console.log(err);
                    } else {
                      client
                        .query(query)
                        .then((res) => {
                            console.log(res.rows[0].user_id);
                            userid = res.rows[0].user_id;
              
                            //フォルダに保存
                            QRCode.toFile(path.join(imageDir, QRfile + '.png'), userid, (error) => {
                            if (error) {
                                console.log(error);
                                return;
                            }

                            //ファイルのURLを生成し送信・拡張子注意
                            let message = {
                                type: "image",
                                originalContentUrl: 'https://linedemo.onrender.com/'+ QRfile + '.png',
                                previewImageUrl: 'https://linedemo.onrender.com/'+ QRfile + '.png'
                            }
                            events_processed.push(bot.replyMessage(event.replyToken, message));
                            });

                        })
                        .catch((e) => {
                            console.error(e.stack);
                            let errmessage = {
                                type: "text",
                                text: "お客様情報が未登録です。"
                            };
                          events_processed.push(bot.replyMessage(event.replyToken, errmessage));
                        });
                    }
                })

                
            }
        // この処理の対象をイベントタイプがポストバックだった場合。
        } else if (event.type == "postback") {
            // 「イベント一覧」の場合
            if(event.postback.data.split('=')[0] == "event_id"){
                // DB登録処理
                const query = {
                    text: 'INSERT INTO t_yoyaku(event_cd, kaisaiti_cd, user_id, reserve_time) VALUES($1, $2, $3, $4)',
                    values: [event.postback.data.split('=')[1], event.postback.data.split('=')[2] , event.source.userId, event.postback.data.split('=')[3] + ' ' + event.postback.params.time + ':00.000'],
                }

                const query_id = {
                    text: "SELECT setval('t_yoyaku_id_seq', (SELECT MAX(id) FROM t_yoyaku))",
                }

                client.connect(function (err, client) {
                    if (err) {
                    console.log(err);
                    } else {
                    client
                        .query(query)
                        .then(() => {
                            console.log('Data Inserted.');
                            client.query(query_id)
                            .then((res) => {
                                //データを取りだす
                                const bufferData = fs.readFileSync('a_ninzu.json')
                                // データを文字列に変換
                                const dataJSON = bufferData.toString()
                                //JSONのデータをJavascriptのオブジェクトに
                                const data = JSON.parse(dataJSON)
                                for(let i = 1; i < 10; i++){
                                    data.contents.body.contents[i].action.data = 'a_ninzu=' + i + '=' + res.rows[0].setval;
                                }
                                events_processed.push(bot.replyMessage(event.replyToken, data));
                            })                     
                        })
                        .catch((e) => {
                        console.error(e.stack);
                        });
                    }
                });
            }
            else if(event.postback.data.split('=')[0] == "a_ninzu"){

                const query = {
                    text: 'UPDATE t_yoyaku' +
                          '   SET reserve_a_count = $1' +
                          ' WHERE id = $2',
                    values: [event.postback.data.split('=')[1], event.postback.data.split('=')[2]],
                }
                client.connect(function (err, client) {
                    if (err) {
                    console.log(err);
                    } else {
                    client
                        .query(query)
                        .then(() => {
                            console.log('Data Updated.');
                            //データを取りだす
                            const bufferData = fs.readFileSync('c_ninzu.json')
                            // データを文字列に変換
                            const dataJSON = bufferData.toString()
                            //JSONのデータをJavascriptのオブジェクトに
                            const data = JSON.parse(dataJSON)

                            for(let i = 1; i < 10; i++){
                                data.contents.body.contents[i].action.data = 'c_ninzu=' + i + '=' + event.postback.data.split('=')[2];
                            }

                            events_processed.push(bot.replyMessage(event.replyToken, data));
                        })
                    }
                })

            }
            else if(event.postback.data.split('=')[0] == "c_ninzu"){
                // DB登録処理
                const query = {
                    text: 'UPDATE t_yoyaku' +
                          '   SET reserve_c_count = $1' +
                          ' WHERE id = $2',
                    values: [event.postback.data.split('=')[1], event.postback.data.split('=')[2]],
                }
                
                console.log(event.postback.data);

                client.connect(function (err, client) {
                    if (err) {
                    console.log(err);
                    } else {
                    client
                        .query(query)
                        .then(() => {
                        console.log('Data Updated.');
                        })
                        .catch((e) => {
                        console.error(e.stack);
                        });
                    }
                });

                let message = {
                    type: 'text',
                    text: '予約が完了しました'
                };

                events_processed.push(bot.replyMessage(event.replyToken, message));
            }
        }
        else {
            const message = {
                type: 'text',
                text: 'Hello World!'
            };
            events_processed.push(bot.replyMessage(event.replyToken, message));
        }
    });

    //すべてのイベント処理が終了したら何個のイベントが処理されたか出力。
    Promise.all(events_processed).then(
        (response) => {
            console.log(`${response.length} event(s) processed.`);
        }
    );
});