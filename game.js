<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<title>MOB SKATE – v3</title>
<meta name="theme-color" content="#0b0c10" />
<link rel="preload" as="image" href="msst1.png">
<link rel="preload" as="image" href="mobs.png">
<link rel="preload" as="image" href="redsk.png">
<link rel="preload" as="image" href="gardw.png">
<link rel="preload" as="image" href="ringtap.png">
<link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="wrap">
    <canvas id="game" width="540" height="960"></canvas>

    <div class="hud" aria-hidden="true">
      <div class="row">
        <div class="chip" id="chipTime">TIME 0.00</div>
        <div class="chip" id="chipSpeed">SPD 0</div>
        <div class="chip" id="chipRing">RING 0  /  COMBO 0</div>
      </div>

      <div class="ctrl">
        <button id="btnAccel" class="btn btn-accel" type="button" aria-label="Accelerate">アクセル</button>
        <button id="btnJump"  class="btn btn-jump"  type="button" aria-label="Jump">ジャンプ</button>
      </div>

      <div class="tapHint" id="tapHint"></div>
      <div class="ver">v3</div>

      <div class="result" id="result">
        <div class="card">
          <p class="title">STAGE CLEAR!</p>
          <p class="stat" id="rsTime"></p>
          <p class="stat" id="rsRing"></p>
          <p class="stat" id="rsCombo"></p>
          <p class="stat" id="rsScore"></p>
          <p class="rank" id="rsRank"></p>
          <p class="tip">画面タップでリスタート</p>
        </div>
      </div>
    </div>
  </div>

<script src="game.js"></script>
</body>
</html>
