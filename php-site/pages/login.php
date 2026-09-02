<?php
$flash = pull_flash();
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in · Grand Holdings</title>
    <link rel="icon" href="assets/logo.png">
    <link rel="stylesheet" href="assets/style.css">
</head>
<body class="login-page">
    <div class="login-backdrop"></div>
    <div class="login-card">
        <img class="login-logo" src="assets/logo.png" alt="Grand Holdings">
        <h1>Grand Holdings</h1>
        <span class="login-kicker">Game lodges · Winelands · Robertson</span>
        <div class="gold-rule"></div>
        <?php if ($flash): ?><div class="flash <?= e($flash['type']) ?>"><?= e($flash['message']) ?></div><?php endif; ?>
        <form method="post" action="index.php" class="stack-form">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="login">
            <label>Email
                <input type="email" name="email" required placeholder="you@example.com">
            </label>
            <label>Password
                <input type="password" name="password" required>
            </label>
            <button class="button primary full" type="submit">Sign in</button>
        </form>
    </div>
</body>
</html>
