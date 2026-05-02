export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    // 解析路径中的自定义标识，支持 /xxx/ 格式
    const pathParts = url.pathname.split('/').filter(Boolean);
    const rawKey = pathParts[0] || '';
    // 核心：对标识进行URL编码，支持中文/特殊字符
    const KV_KEY = rawKey ? encodeURIComponent(rawKey) : '';

    // 1. 首页：无标识时显示输入页面
    if (url.pathname === '/' || !KV_KEY) {
      return new Response(inputHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    // 2. 主页面：携带标识访问
    if (pathParts.length === 1) {
      return new Response(pageHtml(KV_KEY, origin, rawKey), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    // 3. 上传文件 API
    if (pathParts[1] === "upload" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file");
        const buf = await file.arrayBuffer();

        await env.FILE_KV.put(KV_KEY, buf, {
          metadata: { name: file.name, size: file.size }
        });
        return new Response("ok");
      } catch (err) {
        return resMsg("上传失败，文件可能超过25MB", 400);
      }
    }

    // 4. 下载文件 API
    if (pathParts[1] === "download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("未找到文件", 404);
      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    // 5. 删除文件 API
    if (pathParts[1] === "delete") {
      await env.FILE_KV.delete(KV_KEY);
      return new Response("ok");
    }

    // 6. 获取文件信息 API
    if (pathParts[1] === "info") {
      const { metadata } = await env.FILE_KV.getWithMetadata(KV_KEY);
      return new Response(JSON.stringify({
        exist: !!metadata,
        name: metadata?.name || "",
        size: metadata?.size || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return resMsg("404", 404);
  }
};

function resMsg(text, status = 200) {
  return new Response(text, { status });
}

// 根路径：输入自定义标识页面
function inputHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>创建文件空间</title>
<style>
* {margin:0;padding:0;box-sizing:border-box;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;}
body {
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  padding:20px;
}
.card {
  background:rgba(255,255,255,0.55);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,0.6);border-radius:20px;
  padding:32px;width:100%;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.1);
  display:flex;flex-direction:column;gap:20px;
}
.title {font-size:24px;color:#111;text-align:center;font-weight:600;}
.tip {color:#666;font-size:14px;text-align:center;}
input {
  padding:16px;border-radius:14px;border:1px solid #ddd;
  font-size:16px;outline:none;transition:0.2s;
}
input:focus {border-color:#3b82f6;}
.btn {
  padding:16px;border:none;border-radius:14px;background:#3b82f6;
  color:#fff;font-size:16px;font-weight:500;cursor:pointer;
  transition:0.2s;
}
.btn:hover {transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.1);}
</style>
</head>
<body>
<div class="card">
  <h2 class="title">创建专属文件空间</h2>
  <p class="tip">输入自定义标识（支持中文），创建独立文件存储</p>
  <input type="text" id="key" placeholder="例如：我的文件、test、文档123" autocomplete="off">
  <button class="btn" onclick="go()">进入空间</button>
</div>
<script>
function go(){
  const key = document.getElementById('key').value.trim();
  if(!key) {alert('请输入标识');return;}
  // 自动跳转到 域名/标识/
  window.location.href = '/' + encodeURIComponent(key) + '/';
}
</script>
</body>
</html>
`;
}

// 文件操作主页面（动态绑定标识）
function pageHtml(KV_KEY, origin, rawKey) {
  const basePath = `/${encodeURIComponent(rawKey)}`;
  const shareUrl = `${origin}${basePath}/`;
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EdgeCache - ${rawKey}</title>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  padding: 20px;
}
.card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card-title {
  font-size: 24px;
  color: #111;
  text-align: center;
  font-weight: 600;
}
.tip {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
}
.file-info {
  background: rgba(255, 255, 255, 0.7);
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}
.btn {
  padding: 16px;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: 0.2s;
}
.btn-primary {background: #3b82f6;color: #fff;}
.btn-success {background: #10b981;color: #fff;}
.btn-danger {background: #ef4444;color: #fff;}
.upload-btn {
  background: #3b82f6;
  color: #fff;
  padding: 16px;
  border-radius: 14px;
  cursor: pointer;
  text-align: center;
  font-size: 16px;
}
#status {
  color: #dc2626;
  font-size: 14px;
  text-align: center;
  min-height: 20px;
}
#uploadArea, #fileArea {display: none;}
input[type="file"] {position: absolute;opacity: 0;width: 0;height: 0;}
.btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
</style>
</head>
<body>
<div id="uploadArea" class="card">
  <h2 class="card-title">上传文件</h2>
  <p class="tip">空间标识：${rawKey} | 单文件最大25MB</p>
  <label class="upload-btn" for="file">选择文件上传</label>
  <input type="file" id="file">
  <div id="status"></div>
</div>

<div id="fileArea" class="card">
  <h2 class="card-title">当前文件</h2>
  <div class="file-info" id="fileInfo"></div>
  <div class="btn-group">
    <button class="btn btn-primary" onclick="download()">下载文件</button>
    <button class="btn btn-success" onclick="share()">分享链接</button>
    <button class="btn btn-danger" onclick="delFile()">删除文件</button>
  </div>
</div>

<script>
const basePath = "${basePath}";
const shareUrl = "${shareUrl}";

function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

async function loadInfo(){
  const res=await fetch(basePath+'/info');
  const d=await res.json();
  
  const uploadArea = document.getElementById('uploadArea');
  const fileArea = document.getElementById('fileArea');
  const status = document.getElementById('status');

  if(!d.exist){
    uploadArea.style.display = 'flex';
    fileArea.style.display = 'none';
    status.innerText = '';
    return;
  }
  uploadArea.style.display = 'none';
  fileArea.style.display = 'flex';
  document.getElementById('fileInfo').innerText = d.name+'\\n大小：'+fmtSize(d.size);
}

document.getElementById('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const fd = new FormData();
  fd.append('file', f);
  
  const res = await fetch(basePath+'/upload', { method:'POST', body:fd });
  const text = await res.text();
  if(!res.ok){
    document.getElementById('status').innerText = text;
  }else{
    document.getElementById('status').innerText = '';
    loadInfo();
  }
});

function download(){window.location.href=basePath+'/download'}
async function delFile(){await fetch(basePath+'/delete');loadInfo();}

// 分享功能：复制当前链接
async function share(){
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert('链接复制成功！');
  } catch (e) {
    alert('复制失败，请手动复制：'+shareUrl);
  }
}

window.onload=loadInfo;
</script>
</body>
</html>
`;
}