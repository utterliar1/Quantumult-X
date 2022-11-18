/* eslint-disable */
/*
两种方案
1、打开京东APP(需要杀掉后台
2、打开京东APP 右上角的消息

====================
## 以下参数都支持在qx环境变量 优先qx环境变量
可在脚本内填写 但不建议

青龙面板 需要应用支持环境变量 权限
qlhost 面板地址 格式http://192.168.1.1:5600
clientId 应用Client ID
clientSecret 应用 Client Secret

TG 通知
TG_BOT_TOKEN bot_token
TG_USER_ID user_id

下方35、36行填入bot_token和user_id
====================
重写 二选一
# 获取京东WsKey.
1、打开京东APP 需要杀掉后台
https:\/\/api\.m\.jd\.com\/client\.action\?functionId=genToken url script-request-header GetWskey.js
https:\/\/plogin\.m\.jd\.com\/jd-mlogin\/static\/html\/appjmp_blank\.html url script-request-header GetWskey.js
2、打开京东APP 右上角消息
https:\/\/api-dd\.jd\.com\/client\.action\?functionId=getSessionLog  url script-request-header GetWskey.js
[mitm]
hostname = api.m.jd.com, plogin.m.jd.com, api-dd.jd.com

*/

const $ = new Env('获取WsKey');

let JD_WSCK_NAME = 'JD_WSCK' // 青龙面板wskey的环境变量的值名称
// ==============青龙面板======================
let qlhost = ''; // http://192.168.1.1:5600
let clientId = '';
let clientSecret = '';
$.QLtoken = ''

clientId = $.isNode() ? (process.env.ql_clientId ? process.env.ql_clientId : `${clientId}`) : ($.getdata('ql_clientId') ? $.getdata('ql_clientId') : `${clientId}`);
clientSecret = $.isNode() ? (process.env.ql_clientSecret ? process.env.ql_clientSecret : `${clientSecret}`) : ($.getdata('ql_clientSecret') ? $.getdata('ql_clientSecret') : `${clientSecret}`);
qlhost = $.isNode() ? (process.env.ql_host ? process.env.ql_host : `${qlhost}`) : ($.getdata('ql_host') ? $.getdata('ql_host') : `${qlhost}`);
$.QLtoken = ($.getdata('ql_token') ? $.getdata('ql_token') : `${$.QLtoken}`);
$.searchValue = ''
// ==============TG 通知======================
let TG_BOT_TOKEN = "";
let TG_USER_ID = "";
TG_BOT_TOKEN = $.getdata('TG_BOT_TOKEN') ? $.getdata('TG_BOT_TOKEN') : `${TG_BOT_TOKEN}`;
TG_USER_ID = $.getdata('TG_USER_ID') ? $.getdata('TG_USER_ID') : `${TG_USER_ID}`;


let isGetWsKey = typeof $request !== 'undefined' || typeof $response !== 'undefined'
if (isGetWsKey) {
  !(async () => {
    await GetWsKey()
    $.done();
  })()
  .catch((e) => $.logErr(e))
  .finally(() => $.done())
}


async function GetWsKey() {
  if ($request.url.indexOf("appjmp_blank.html") > -1) {
    let pincookie = ($request.headers['Cookie'] || $request.headers['cookie'] || '')
    let pin = pincookie.match(/(pt_pin=[^;]*)/)[1].replace('pt_pin=', '');
    console.log(`pin:pin=${pin}`)
    $.setdata(pin, "JD_pin")
  }else if ($request.url.indexOf("genToken") > -1) {
    let keycookie = ($request.headers['Cookie'] || $request.headers['cookie'] || '')
    let key = keycookie.match(/(wskey=[^;]*)/)[1]
    console.log(`key:${key}`)
    $.setdata(key, "JD_wskey")
  }else if ($request.url.indexOf("getSessionLog") > -1) {
    let cookie = ($request.headers['Cookie'] || $request.headers['cookie'] || '')
    let pin = cookie.match(/(pin=[^;]*)/)[1].replace('pin=', '');
    console.log(`pin:pin=${pin}`)
    $.setdata(pin, "JD_pin")
    let key = cookie.match(/(wskey=[^;]*)/)[1]
    console.log(`key:${key}`)
    $.setdata(key, "JD_wskey")
  }
  if ($.getdata("JD_pin") && $.getdata("JD_wskey")) {
    let pin = $.getdata("JD_pin")
    let wskey = `pin=${$.getdata("JD_pin")};${$.getdata("JD_wskey")};`
    $.setdata("", "JD_pin")
    $.setdata("", "JD_wskey")
    console.log(`wskey:${wskey}`)
    let res = await wskey_update(JD_WSCK_NAME, decodeURIComponent(pin), wskey, wskey, `pin=${pin};`);
    $.msg($.name, `获取wskey成功🎉`, `${res}`);
    await tgBotNotifys(wskey);
  }
}
async function wskey_update(name, DecodeName, CookieValue, search ='', pin) {
  let msg = '更新失败'
  if (qlhost && clientId && clientSecret) {
    $.searchValue = JD_WSCK_NAME
    $.QLEnv = ''
    if ($.QLtoken) {
      await lookQLEnv(0)
    } else {
      await loginQLEnv()
    }
    let flag = 0
    let _id = ''
    let status = 1
    let remarks = DecodeName
    if (typeof $.QLEnv == 'object' && $.QLEnv.length > 0) {
      flag = 1
      for (let i in $.QLEnv) {
        let item = $.QLEnv[i]
        if (item.name == name && item.value.indexOf(pin) > -1) {
          if(item.value.indexOf(search) == -1){
            remarks = item.remarks || DecodeName
            if(item.id) status = 2
            _id = item._id || item.id
          }else{
            flag = 0
            msg = `[${item.remarks || DecodeName}]与面板一致 不更新`
          }
          break
        }
      }
    }else if(typeof $.QLEnv == 'object' && $.QLEnv.length == 0){
      flag = 1
      console.log(`面板无【${JD_WSCK_NAME}】`)
    }
    if(flag == 1){
      msg = await setQLEnv(name, remarks, CookieValue, _id, status)
      if(msg == true){
        msg = `青龙面板更新[${remarks}]成功`
      }else{
        msg = `青龙面板更新[${remarks}]失败`
      }
    }
  }else{
    msg = '缺少青龙面板参数'
  }
  if($.loginError){
    msg = `${$.loginError}\n${msg}`
  }
  return msg
}

async function setQLEnv(name, remarks, value, _id = '', status = 1) {
  return new Promise(async resolve => {
    let method = 'post'
    let body = [{ "name": `${name}`, "value": `${value}`, "remarks": `${remarks}` }]
    if (_id) {
      method = 'put'
      if(status == 1){
        body = { "name": `${name}`, "value": `${value}`, "remarks": `${remarks}`, "_id": `${_id}` }
      }else{
        body = { "name": `${name}`, "value": `${value}`, "remarks": `${remarks}`, "id": `${_id}` }
      }
    }
    const options = {
      url: `${qlhost}/open/envs?t=${new Date().getTime()}`,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: `Bearer ${$.QLtoken}`
      },
      body: JSON.stringify(body),
      method: method
    }
    $.put(options, (err, resp, _data) => {
      let msg = false
      try {
        if (err) {
          console.log(`${JSON.stringify(err)}`)
          console.log(`青龙面板更新Env API请求失败，请检查网路重试`)
        } else {
            let res = $.toObj(_data);
            if(typeof res == 'object'){
              if (res.code === 200 && res.data) {
                if (res.data.value && value == res.data.value || res.data[0].value && value == res.data[0].value) {
                  msg = true
                } else {
                  console.log(`青龙面板更新Env：${_data}`)
                }
              } else if ((res.err && res.err === 400) || (res.code && res.code === 400) && res.msg) {
                $.loginError = res.msg
                console.log(`青龙面板更新Env：${res.msg}`)
              } else {
                console.log(`青龙面板更新Env：${_data}`)
              }
            }else{
              console.log(`青龙面板更新Env：${_data}`)
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve(msg);
      }
    })
  })
}
async function loginQLEnv() {
  return new Promise(async resolve => {
    const options = {
      url: `${qlhost}/open/auth/token?client_id=${clientId}&client_secret=${clientSecret}`,
    }
    $.get(options, async (err, resp, _data) => {
      try {
        if (err) {
          console.log(`${JSON.stringify(err)}`)
          console.log(`青龙面板登录 API请求失败，请检查网路重试`)
        } else {
          let res = $.toObj(_data,_data);
          if(typeof res == 'object'){
            if (res.code === 200) {
              $.QLtoken = res["data"]["token"] || ''
              if ($.QLtoken) {
                $.setdata($.QLtoken, 'ql_token');
                await lookQLEnv(1)
              }
            } else if (res.message) {
              $.loginError = res.message
              console.log(`青龙面板登录：${res.message}`)
            } else {
              console.log(`青龙面板登录：${_data}`)
            }
          }else{
            console.log(`青龙面板登录：${_data}`)
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve();
      }
    })
  })
}
async function lookQLEnv(flag = 0) {
  return new Promise(async resolve => {
    const options = {
      url: `${qlhost}/open/envs?searchValue=${$.searchValue}&t=${new Date().getTime()}`,
      headers: {
        Authorization: `Bearer ${$.QLtoken}`
      },
    }
    $.get(options, async (err, resp, _data) => {
      try {
        if (err) {
          if (flag == 0) {
            // 重新登录
            await loginQLEnv()
          } else {
            console.log(`${JSON.stringify(err)}`)
            console.log(`青龙面板获取Env API请求失败，请检查网路重试`)
          }
        } else {
          let res = $.toObj(_data);
          if(typeof res == 'object'){
            if (res.code === 200) {
              $.QLEnv = res["data"] || ''
            } else if ((res.err && res.err === 400) || (res.code && res.code === 400) && res.msg) {
              if (flag == 0) {
                await loginQLEnv()
              } else {
                $.loginError = res.msg
                console.log(`青龙面板获取Env：${res.msg}`)
              }
            } else {
              if (flag == 0) {
                await loginQLEnv()
              } else {
                console.log(`青龙面板获取Env：${_data}`)
              }
            }
          }else{
            if (flag == 0) await loginQLEnv()
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve();
      }
    })
  })
}
function tgBotNotifys(text) {
  return  new Promise(resolve => {
    let isok = false
    if (TG_BOT_TOKEN && TG_USER_ID) {
      const options = {
        url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
        body: `chat_id=${TG_USER_ID}&text=${text}&disable_web_page_preview=true`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
      $.post(options, (err, resp, data) => {
        try {
          if (err) {
            console.log('telegram发送通知消息失败！！\n')
            console.log(err);
          } else {
            data = JSON.parse(data);
            if (data.ok) {
              isok = true
              console.log('Telegram发送通知消息完成。\n')
            } else if (data.error_code === 400) {
              console.log('请主动给bot发送一条消息并检查接收用户ID是否正确。\n')
            } else if (data.error_code === 401){
              console.log('Telegram bot token 填写错误。\n')
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(isok);
        }
      })
    } else {
      console.log('您未提供telegram机器人推送所需的TG_BOT_TOKEN和TG_USER_ID，取消telegram推送消息通知\n');
      resolve(isok)
    }
  })
}

// prettier-ignore
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}, \u5f00\u59cb!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}put(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"put";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name}, \u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
