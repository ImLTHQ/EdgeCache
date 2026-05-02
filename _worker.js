const KV_KEY = "single_file_store";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(pageHtml(), {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file");
        const buf = await file.arrayBuffer();

        await env.FILE_KV.put(KV_KEY, buf, {
          metadata: { name: file.name, size: file.size }
        });

        return new Response("ok");
      } catch (err) {
        return resMsg("上传失败, 可能文件过大", 400);
      }
    }

    if (url.pathname === "/download") {
      const { value, metadata } = await env.FILE_KV.getWithMetadata(KV_KEY, "arrayBuffer");
      if (!value) return resMsg("未上传文件", 404);
      return new Response(value, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(metadata.name)}"`
        }
      });
    }

    if (url.pathname === "/delete") {
      await env.FILE_KV.delete(KV_KEY);
      return new Response("ok");
    }

    if (url.pathname === "/info") {
      const { metadata } = await env.FILE_KV.getWithMetadata(KV_KEY);
      return new Response(JSON.stringify({
        exist: !!metadata,
        name: metadata?.name || "",
        size: metadata?.size || 0
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return resMsg("404");
  }
};

function resMsg(text, status = 200) {
  return new Response(text, { status });
}

function pageHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EdgeCache</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui}

html,body{
  width:100%;
  height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background: linear-gradient(135deg, rgb(255, 100, 180) 0%, rgb(200, 150, 255) 50%, rgb(0, 255, 255) 100%);
  background-attachment:fixed;
}

/* 核心：高度固定为屏幕 1/3 */
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 33vh;
  width: 100%;
  padding: 0 20px;
}

/* 盒子：宽度自适应 + 最小最大限制 + 高度100% */
.box {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 16px;
  padding: 28px 32px;
  height: 100%;
  min-width: 320px;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

h3{
  font-size:22px;
  margin-bottom:10px;
  color:#111;
  text-align:center;
}

.tip{
  color:#dc2626;
  font-size:14px;
  text-align:center;
  margin-bottom:20px;
}

.info{
  background:rgba(255,255,255,0.6);
  padding:14px 18px;
  border-radius:10px;
  margin:14px 0;
  text-align:center;
  font-size:15px;
  line-height:1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

button,.upload-btn{
  width:100%;
  padding:14px;
  border:none;
  border-radius:12px;
  font-size:15px;
  font-weight:500;
  cursor:pointer;
  margin:6px 0;
  background:#3b82f6;
  color:#fff;
  text-align:center;
  display:block;
}

.btn-red{
  background:#ef4444;
}

#status{
  margin-top:16px;
  color:#dc2626;
  font-size:14px;
  text-align:center;
  min-height:20px;
}

#uploadArea, #fileArea{
  display:none;
}

input[type="file"]{
  width:1px; height:1px; opacity:0; position:absolute; z-index:-1;
}
</style>
</head>
<body>

<div class="container">
  <div id="uploadArea" class="box">
    <h3>上传文件</h3>
    <p class="tip">仅保存1个 · KV 单文件限制 25MB</p>
    <label class="upload-btn" for="file">上传文件</label>
    <input type="file" id="file">
    <div id="status"></div>
  </div>

  <div id="fileArea" class="box">
    <h3>当前文件</h3>
    <div class="info" id="fileInfo"></div>
    <button class="btn-blue" onclick="download()">下载</button>
    <button class="btn-red" onclick="delFile()">删除</button>
  </div>
</div>

<script>
function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

async function loadInfo(){
  const res=await fetch('/info');
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
  document.getElementById('fileInfo').innerText = '文件名：'+d.name+'\\n大小：'+fmtSize(d.size);
}

document.getElementById('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if(!f) return;

  const fd = new FormData();
  fd.append('file', f);
  
  const res = await fetch('/upload', { method:'POST', body:fd });
  const text = await res.text();

  if(!res.ok){
    document.getElementById('status').innerText = text;
  }else{
    document.getElementById('status').innerText = '';
    loadInfo();
  }
});

function download(){window.location.href='/download'}

async function delFile(){
  await fetch('/delete');
  loadInfo();
}

window.onload=loadInfo;
</script>
</body>
</html>
  `;
}