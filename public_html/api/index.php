<?php
// CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load private config from OUTSIDE the web root (never served over HTTP)
$__configPath = dirname(dirname(__DIR__)) . '/vcfpro-config.php';
if (!file_exists($__configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server misconfigured']);
    exit;
}
$__config = require $__configPath;
if (empty($__config['jwt_secret'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Server misconfigured']);
    exit;
}
define('JWT_SECRET', $__config['jwt_secret']);

// Helper functions for JWT
function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function generateJwt($userId, $username, $role) {
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = json_encode([
        'id' => (int)$userId,
        'username' => $username,
        'role' => $role,
        'exp' => time() + (7 * 24 * 60 * 60) // 7 days
    ]);
    
    $base64UrlHeader = base64UrlEncode($header);
    $base64UrlPayload = base64UrlEncode($payload);
    
    $secret = JWT_SECRET;
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = base64UrlEncode($signature);
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function authenticate() {
    $authHeader = '';
    
    // Check various sources for authorization header
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_REDIRECT_HTTP_AUTHORIZATION;
    } else {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $authHeader = $headers['authorization'];
        }
    }
    
    if (empty($authHeader)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $parts = explode(' ', $authHeader);
    if (count($parts) !== 2 || strtolower($parts[0]) !== 'bearer') {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $jwt = $parts[1];
    $tokenParts = explode('.', $jwt);
    if (count($tokenParts) !== 3) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $header = base64UrlDecode($tokenParts[0]);
    $payload = base64UrlDecode($tokenParts[1]);
    $signatureProvided = $tokenParts[2];
    
    $secret = JWT_SECRET;
    $signature = hash_hmac('sha256', $tokenParts[0] . "." . $tokenParts[1], $secret, true);
    $base64UrlSignature = base64UrlEncode($signature);
    
    if ($base64UrlSignature !== $signatureProvided) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $data = json_decode($payload, true);
    if (isset($data['exp']) && $data['exp'] < time()) {
        http_response_code(401);
        echo json_encode(['error' => 'Token expired']);
        exit;
    }
    
    return $data;
}

// Database setup
// Database lives OUTSIDE the web root so it can never be downloaded.
$dbPath = dirname(dirname(__DIR__)) . '/vcfpro-data/database.sqlite';
if (!file_exists($dbPath)) {
    // Fail loudly rather than silently creating a blank database.
    http_response_code(500);
    echo json_encode(['error' => 'Database not found']);
    exit;
}
$dbExists = true;

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Dynamically expand database schema if it already exists
    try {
        @$pdo->exec("ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0;");
    } catch (Exception $e) {}
    try {
        @$pdo->exec("ALTER TABLE posts ADD COLUMN dislikes INTEGER DEFAULT 0;");
    } catch (Exception $e) {}
    try {
        @$pdo->exec("ALTER TABLE posts ADD COLUMN url TEXT;");
    } catch (Exception $e) {}
    try {
        @$pdo->exec("ALTER TABLE contact_messages ADD COLUMN email TEXT;");
    } catch (Exception $e) {}

    // Ensure comments table exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          author_name TEXT NOT NULL,
          author_role TEXT DEFAULT 'Reader',
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          parent_id INTEGER,
          author_key TEXT,
          FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
    ");

    try {
        @$pdo->exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER;");
    } catch (Exception $e) {}
    try {
        @$pdo->exec("ALTER TABLE comments ADD COLUMN author_key TEXT;");
    } catch (Exception $e) {}

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

if (!$dbExists) {
    // Create tables
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          role TEXT
        );

        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          content TEXT,
          excerpt TEXT,
          featured_image TEXT,
          status TEXT DEFAULT 'draft',
          category_id INTEGER,
          url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          published_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          slug TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          slug TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_tags (
          post_id INTEGER,
          tag_id INTEGER,
          PRIMARY KEY (post_id, tag_id),
          FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS media (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          url TEXT NOT NULL,
          type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT,
          message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS active_visitors (
          client_id TEXT PRIMARY KEY,
          last_ping INTEGER
        );
    ");

    // Insert Default admin user
    $hash = password_hash('admin', PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    $stmt->execute(['admin', $hash, 'admin']);

    // Default settings
    $settingsTheme = json_encode([
        'mode' => 'dark',
        'accentColor' => '#FF6321'
    ]);
    $stmtSettings = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
    $stmtSettings->execute(['theme', $settingsTheme]);
}

// Router parsing
$requestUri = $_SERVER['REQUEST_URI'];
if (strpos($requestUri, '?') !== false) {
    $requestUri = substr($requestUri, 0, strpos($requestUri, '?'));
}

$route = '';
if (preg_match('/\/api\/(.*)$/i', $requestUri, $matches)) {
    $route = $matches[1];
}

$route = rtrim($route, '/');

// Endpoint router logic
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'auth/login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = isset($input['username']) ? $input['username'] : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password required']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }

    $token = generateJwt($user['id'], $user['username'], $user['role']);
    echo json_encode([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'role' => $user['role']
        ]
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'auth/register') {
        http_response_code(403);
        echo json_encode(['error' => 'Registration is disabled']);
        exit;
    $input = json_decode(file_get_contents('php://input'), true);
    $username = isset($input['username']) ? $input['username'] : '';
    $password = isset($input['password']) ? $input['password'] : '';
    $role = isset($input['role']) ? $input['role'] : 'user';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password required']);
        exit;
    }

    try {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
        $stmt->execute([$username, $hash, $role]);
        
        $userId = $pdo->lastInsertId();
        $token = generateJwt((int)$userId, $username, $role);

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => (int)$userId,
                'username' => $username,
                'role' => $role
            ]
        ]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'UNIQUE') !== false) {
            http_response_code(400);
            echo json_encode(['error' => 'Username already exists']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
        }
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'auth/change-password') {
    $user_data = authenticate();
    $userId = (int)$user_data['id'];

    $input = json_decode(file_get_contents('php://input'), true);
    $currentPassword = isset($input['currentPassword']) ? $input['currentPassword'] : '';
    $newPassword = isset($input['newPassword']) ? $input['newPassword'] : '';

    if (empty($currentPassword) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['error' => 'Current password and new password are required']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, $user['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Current password does not match']);
        exit;
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
    $stmt->execute([$hash, $userId]);

    echo json_encode(['success' => true, 'message' => 'Password updated successfully']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'auth/logout') {
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'auth/me') {
    $user = authenticate();
    echo json_encode(['user' => $user]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'posts') {
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    $category = isset($_GET['category']) ? $_GET['category'] : '';

    $query = "SELECT p.*, c.name as category_name, c.slug as category_slug 
              FROM posts p 
              LEFT JOIN categories c ON p.category_id = c.id";
    $conditions = [];
    $params = [];

    if (!empty($status) && $status !== 'all') {
        $conditions[] = "p.status = ?";
        $params[] = $status;
    } else if (empty($status)) {
        $conditions[] = "p.status = 'published'";
    }

    if (!empty($category)) {
        $conditions[] = "c.slug = ?";
        $params[] = $category;
    }

    if (count($conditions) > 0) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }

    $query .= " ORDER BY p.created_at DESC";

    // Build values array directly in the query to avoid PDO LIMIT string binding issues in SQLite
    if ($limit > 0) {
        $query .= " LIMIT " . (int)$limit;
    }
    if ($offset > 0) {
        $query .= " OFFSET " . (int)$offset;
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $posts = $stmt->fetchAll();

    foreach ($posts as &$post) {
        $post['id'] = (int)$post['id'];
        if ($post['category_id'] !== null) {
            $post['category_id'] = (int)$post['category_id'];
        }
    }
    echo json_encode($posts);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^posts\/([0-9]+)$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $stmt = $pdo->prepare("SELECT p.*, c.name as category_name, c.slug as category_slug 
                           FROM posts p 
                           LEFT JOIN categories c ON p.category_id = c.id
                           WHERE p.id = ?");
    $stmt->execute([$id]);
    $post = $stmt->fetch();

    if (!$post) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found']);
        exit;
    }

    $post['id'] = (int)$post['id'];
    if ($post['category_id'] !== null) {
        $post['category_id'] = (int)$post['category_id'];
    }
    echo json_encode($post);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^posts\/slug\/(.+)$/i', $route, $matches)) {
    $slug = $matches[1];
    $stmt = $pdo->prepare("SELECT p.*, c.name as category_name, c.slug as category_slug 
                           FROM posts p 
                           LEFT JOIN categories c ON p.category_id = c.id
                           WHERE p.slug = ?");
    $stmt->execute([$slug]);
    $post = $stmt->fetch();

    if (!$post) {
        http_response_code(404);
        echo json_encode(['error' => 'Post not found']);
        exit;
    }

    $post['id'] = (int)$post['id'];
    if ($post['category_id'] !== null) {
        $post['category_id'] = (int)$post['category_id'];
    }
    echo json_encode($post);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('/^posts\/([0-9]+)\/like$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $stmt = $pdo->prepare("UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?");
    $stmt->execute([$id]);
    $stmt = $pdo->prepare("SELECT likes, dislikes FROM posts WHERE id = ?");
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    echo json_encode(['success' => true, 'likes' => (int)$post['likes'], 'dislikes' => (int)$post['dislikes']]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('/^posts\/([0-9]+)\/dislike$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $stmt = $pdo->prepare("UPDATE posts SET dislikes = COALESCE(dislikes, 0) + 1 WHERE id = ?");
    $stmt->execute([$id]);
    $stmt = $pdo->prepare("SELECT likes, dislikes FROM posts WHERE id = ?");
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    echo json_encode(['success' => true, 'likes' => (int)$post['likes'], 'dislikes' => (int)$post['dislikes']]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'comments/all') {
    authenticate();
    try {
        $stmt = $pdo->query("
            SELECT c.*, p.title as post_title 
            FROM comments c
            LEFT JOIN posts p ON c.post_id = p.id
            ORDER BY c.created_at DESC
        ");
        $comments = $stmt->fetchAll();
        foreach ($comments as &$comm) {
            $comm['id'] = (int)$comm['id'];
            $comm['post_id'] = (int)$comm['post_id'];
        }
        echo json_encode($comments);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('/^posts\/([0-9]+)\/comments$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $stmt = $pdo->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC");
    $stmt->execute([$id]);
    $comments = $stmt->fetchAll();
    echo json_encode($comments);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && preg_match('/^posts\/([0-9]+)\/comments$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $author_name = isset($input['author_name']) ? $input['author_name'] : '';
    $author_role = isset($input['author_role']) ? $input['author_role'] : 'Reader';
    $content = isset($input['content']) ? $input['content'] : '';
    $parent_id = !empty($input['parent_id']) ? (int)$input['parent_id'] : null;
    $author_key = isset($input['author_key']) ? $input['author_key'] : null;

    if (empty($author_name) || empty($content)) {
        http_response_code(400);
        echo json_encode(['error' => 'Name and content are required']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO comments (post_id, author_name, author_role, content, parent_id, author_key) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $author_name, $author_role, $content, $parent_id, $author_key]);

    $stmt = $pdo->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC");
    $stmt->execute([$id]);
    $comments = $stmt->fetchAll();
    echo json_encode(['success' => true, 'comments' => $comments]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' && preg_match('/^comments\/([0-9]+)$/i', $route, $matches)) {
    $id = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $content = isset($input['content']) ? $input['content'] : '';
    $author_key = isset($input['author_key']) ? $input['author_key'] : '';

    if (empty($content) || empty($author_key)) {
        http_response_code(400);
        echo json_encode(['error' => 'Content and author_key are required']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT author_key FROM comments WHERE id = ?");
    $stmt->execute([$id]);
    $comment = $stmt->fetch();

    if (!$comment || $comment['author_key'] !== $author_key) {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized to edit this comment']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE comments SET content = ? WHERE id = ?");
    $stmt->execute([$content, $id]);
    
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^comments\/([0-9]+)$/i', $route, $matches)) {
    $id = (int)$matches[1];
    
    $headers = getallheaders();
    $author_key = isset($_GET['author_key']) ? $_GET['author_key'] : (isset($headers['x-author-key']) ? $headers['x-author-key'] : null);
    
    if (!$author_key) {
        authenticate();
    } else {
        $stmt = $pdo->prepare("SELECT author_key FROM comments WHERE id = ?");
        $stmt->execute([$id]);
        $comment = $stmt->fetch();
        if (!$comment || $comment['author_key'] !== $author_key) {
            http_response_code(403);
            echo json_encode(['error' => 'Unauthorized']);
            exit;
        }
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM comments WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete comment: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'posts') {
    authenticate();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $title = isset($input['title']) ? $input['title'] : '';
    $slug = isset($input['slug']) ? $input['slug'] : '';
    $content = isset($input['content']) ? $input['content'] : '';
    $excerpt = isset($input['excerpt']) ? $input['excerpt'] : '';
    $featured_image = isset($input['featured_image']) ? $input['featured_image'] : '';
    $status = isset($input['status']) ? $input['status'] : 'draft';
    $category_id = (!empty($input['category_id'])) ? (int)$input['category_id'] : null;
    $url = isset($input['url']) ? $input['url'] : null;

    $published_at = ($status === 'published') ? date('Y-m-d H:i:s') : null;

    try {
        $stmt = $pdo->prepare("INSERT INTO posts (title, slug, content, excerpt, featured_image, status, category_id, url, published_at) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $slug, $content, $excerpt, $featured_image, $status, $category_id, $url, $published_at]);
        echo json_encode(['id' => (int)$pdo->lastInsertId()]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'UNIQUE') !== false) {
            http_response_code(400);
            echo json_encode(['error' => 'Slug must be unique']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
        }
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' && preg_match('/^posts\/([0-9]+)$/i', $route, $matches)) {
    authenticate();
    $id = (int)$matches[1];
    $input = json_decode(file_get_contents('php://input'), true);

    $title = isset($input['title']) ? $input['title'] : '';
    $slug = isset($input['slug']) ? $input['slug'] : '';
    $content = isset($input['content']) ? $input['content'] : '';
    $excerpt = isset($input['excerpt']) ? $input['excerpt'] : '';
    $featured_image = isset($input['featured_image']) ? $input['featured_image'] : '';
    $status = isset($input['status']) ? $input['status'] : 'draft';
    $category_id = (!empty($input['category_id'])) ? (int)$input['category_id'] : null;
    $url = isset($input['url']) ? $input['url'] : null;

    try {
        $stmt = $pdo->prepare("UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, status = ?, category_id = ?, url = ? WHERE id = ?");
        $stmt->execute([$title, $slug, $content, $excerpt, $featured_image, $status, $category_id, $url, $id]);

        if ($status === 'published') {
            $stmtCheck = $pdo->prepare("SELECT published_at FROM posts WHERE id = ?");
            $stmtCheck->execute([$id]);
            $post = $stmtCheck->fetch();
            if (!$post['published_at']) {
                $stmtPub = $pdo->prepare("UPDATE posts SET published_at = datetime('now') WHERE id = ?");
                $stmtPub->execute([$id]);
            }
        }

        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^posts\/([0-9]+)$/i', $route, $matches)) {
    authenticate();
    $id = (int)$matches[1];
    
    try {
        // Explicitly clean up relations to bypass database constraint errors
        $stmtTags = $pdo->prepare("DELETE FROM post_tags WHERE post_id = ?");
        $stmtTags->execute([$id]);

        $stmtComments = $pdo->prepare("DELETE FROM comments WHERE post_id = ?");
        $stmtComments->execute([$id]);

        $stmt = $pdo->prepare("DELETE FROM posts WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete post: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'categories') {
    $stmt = $pdo->query("SELECT * FROM categories ORDER BY name ASC");
    $categories = $stmt->fetchAll();
    foreach ($categories as &$cat) {
        $cat['id'] = (int)$cat['id'];
    }
    echo json_encode($categories);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'categories') {
    authenticate();
    $input = json_decode(file_get_contents('php://input'), true);
    $name = isset($input['name']) ? $input['name'] : '';
    $slug = isset($input['slug']) ? $input['slug'] : '';

    try {
        $stmt = $pdo->prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
        $stmt->execute([$name, $slug]);
        echo json_encode([
            'id' => (int)$pdo->lastInsertId(),
            'name' => $name,
            'slug' => $slug
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^categories\/([0-9]+)$/i', $route, $matches)) {
    authenticate();
    $id = (int)$matches[1];
    try {
        // Explicitly set category_id of references to null before deleting category
        $stmtUpdate = $pdo->prepare("UPDATE posts SET category_id = NULL WHERE category_id = ?");
        $stmtUpdate->execute([$id]);

        $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete category: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'contact') {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = isset($input['email']) ? trim($input['email']) : '';
    $message = isset($input['message']) ? trim($input['message']) : '';

    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email ID is required']);
        exit;
    }

    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is required']);
        exit;
    }

    // Limit to max 200 words
    $words = preg_split('/\s+/', $message, -1, PREG_SPLIT_NO_EMPTY);
    if (count($words) > 200) {
        http_response_code(400);
        echo json_encode(['error' => 'Message cannot exceed 200 words']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO contact_messages (email, message) VALUES (?, ?)");
        $stmt->execute([$email, $message]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save message: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'contact') {
    authenticate();
    try {
        $stmt = $pdo->query("SELECT * FROM contact_messages ORDER BY created_at DESC");
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($messages);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch messages: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^contact\/([0-9]+)$/i', $route, $matches)) {
    authenticate();
    $id = (int)$matches[1];
    try {
        $stmt = $pdo->prepare("DELETE FROM contact_messages WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete message: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'media') {
    authenticate();
    $stmt = $pdo->query("SELECT * FROM media ORDER BY created_at DESC");
    $media = $stmt->fetchAll();
    foreach ($media as &$m) {
        $m['id'] = (int)$m['id'];
    }
    echo json_encode($media);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE' && preg_match('/^media\/([0-9]+)$/i', $route, $matches)) {
    authenticate();
    $id = (int)$matches[1];
    
    // First find item if we can delete file on disk
    try {
        $stmtFind = $pdo->prepare("SELECT url FROM media WHERE id = ?");
        $stmtFind->execute([$id]);
        $row = $stmtFind->fetch();
        if ($row && strpos($row['url'], '/uploads/') === 0) {
            $filename = str_replace('/uploads/', '', $row['url']);
            $filePath = dirname(__DIR__) . '/uploads/' . $filename;
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
    } catch (Exception $e) {}

    try {
        $stmt = $pdo->prepare("DELETE FROM media WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete media: ' . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'media/upload') {
    authenticate();
    
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded']);
        exit;
    }

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload failed with error code ' . $file['error']]);
        exit;
    }

    $filename = $file['name'];
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    // Whitelist: only these extensions may ever be written to /uploads.
    // SVG is deliberately excluded - it can carry executable JavaScript.
    $allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm'];
    if (!in_array($ext, $allowedExt, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'File type not allowed']);
        exit;
    }

    // Cap size at 25 MB
    if ($file['size'] > 25 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large (max 25 MB)']);
        exit;
    }

    // For images, confirm the bytes really are an image - a PHP script renamed
    // to .jpg will fail this check.
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
        $imgInfo = @getimagesize($file['tmp_name']);
        if ($imgInfo === false) {
            http_response_code(400);
            echo json_encode(['error' => 'File is not a valid image']);
            exit;
        }
    }

    $uniqueName = time() . '-' . rand(100000, 999999) . '.' . $ext;

    $uploadsDir = dirname(__DIR__) . '/uploads';
    if (!file_exists($uploadsDir)) {
        mkdir($uploadsDir, 0777, true);
    }

    $targetPath = $uploadsDir . '/' . $uniqueName;
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        $url = '/uploads/' . $uniqueName;
        $type = (strpos($file['type'], 'video') !== false) ? 'video' : 'image';

        try {
            $stmt = $pdo->prepare("INSERT INTO media (filename, url, type) VALUES (?, ?, ?)");
            $stmt->execute([$filename, $url, $type]);
            echo json_encode([
                'id' => (int)$pdo->lastInsertId(),
                'url' => $url,
                'filename' => $filename
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database record failed: ' . $e->getMessage()]);
        }
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to move uploaded file']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'settings') {
    try {
        $stmt = $pdo->query("SELECT * FROM settings");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['key']] = json_decode($row['value'], true);
        }
        echo json_encode($settings);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'settings') {
    authenticate();
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid body']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        foreach ($input as $key => $value) {
            $stmtCheck = $pdo->prepare("SELECT key FROM settings WHERE key = ?");
            $stmtCheck->execute([$key]);
            $exists = $stmtCheck->fetch();

            $jsonValue = json_encode($value);
            if ($exists) {
                $stmtUp = $pdo->prepare("UPDATE settings SET value = ? WHERE key = ?");
                $stmtUp->execute([$jsonValue, $key]);
            } else {
                $stmtIn = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
                $stmtIn->execute([$key, $jsonValue]);
            }
        }
        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Server error']);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $route === 'stats/ping') {
    $input = json_decode(file_get_contents('php://input'), true);
    $clientId = isset($input['clientId']) ? $input['clientId'] : '';
    if (!empty($clientId)) {
        try {
            $now = time() * 1000;
            // Clean up old visitors
            $threshold = $now - 40000;
            $pdo->query("DELETE FROM active_visitors WHERE last_ping <= $threshold");

            // Upsert the client ID
            $stmt = $pdo->prepare("REPLACE INTO active_visitors (client_id, last_ping) VALUES (?, ?)");
            $stmt->execute([$clientId, $now]);

            $stmtCount = $pdo->query("SELECT COUNT(*) FROM active_visitors");
            $count = (int)$stmtCount->fetchColumn();
            
            echo json_encode(['success' => true, 'count' => $count > 0 ? $count : 1]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } else {
        echo json_encode(['success' => true]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $route === 'stats/online') {
    try {
        $now = time() * 1000;
        $threshold = $now - 40000;
        $pdo->query("DELETE FROM active_visitors WHERE last_ping <= $threshold");

        $stmtCount = $pdo->query("SELECT COUNT(*) FROM active_visitors");
        $count = (int)$stmtCount->fetchColumn();
        echo json_encode(['count' => $count > 0 ? $count : 1]);
    } catch (Exception $e) {
        echo json_encode(['count' => 1]);
    }
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint not found: ' . $route]);
exit;
