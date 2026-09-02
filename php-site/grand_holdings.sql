-- Grand Holdings PHP/MySQL database
-- Import this file into the empty database created in xneelo's control panel.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_updates;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS form_submissions;
DROP TABLE IF EXISTS checklist_completion_items;
DROP TABLE IF EXISTS checklist_completions;
DROP TABLE IF EXISTS checklist_facilities;
DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS checklists;
DROP TABLE IF EXISTS user_facilities;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS facilities;

CREATE TABLE facilities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  contact_name VARCHAR(180) NOT NULL DEFAULT '',
  contact_phone VARCHAR(80) NOT NULL DEFAULT '',
  contact_email VARCHAR(180) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(180) NOT NULL,
  role ENUM('admin','manager','basic') NOT NULL DEFAULT 'basic',
  facility_id INT UNSIGNED NULL,
  access_all TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  CONSTRAINT users_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_facilities (
  user_id INT UNSIGNED NOT NULL,
  facility_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (user_id, facility_id),
  KEY user_facilities_facility_idx (facility_id),
  CONSTRAINT user_facilities_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_facilities_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklists (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  frequency ENUM('daily','weekly','monthly','quarterly','yearly') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  checklist_id INT UNSIGNED NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY checklist_items_checklist_idx (checklist_id),
  CONSTRAINT checklist_items_checklist_fk FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_facilities (
  checklist_id INT UNSIGNED NOT NULL,
  facility_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (checklist_id, facility_id),
  CONSTRAINT checklist_facilities_checklist_fk FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
  CONSTRAINT checklist_facilities_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_completions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  checklist_id INT UNSIGNED NOT NULL,
  facility_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  due_date DATE NOT NULL,
  submitted_at DATETIME NULL,
  status ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  UNIQUE KEY checklist_completion_period (checklist_id, facility_id, due_date),
  CONSTRAINT completions_checklist_fk FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
  CONSTRAINT completions_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT completions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE checklist_completion_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  completion_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  note TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY completion_item_unique (completion_id, item_id),
  CONSTRAINT completion_items_completion_fk FOREIGN KEY (completion_id) REFERENCES checklist_completions(id) ON DELETE CASCADE,
  CONSTRAINT completion_items_item_fk FOREIGN KEY (item_id) REFERENCES checklist_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tasks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id INT UNSIGNED NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL,
  expected_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NOT NULL,
  assigned_user_id INT UNSIGNED NULL,
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','closed') NOT NULL DEFAULT 'pending',
  closed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY tasks_facility_idx (facility_id),
  KEY tasks_status_idx (status),
  CONSTRAINT tasks_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT tasks_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT tasks_assigned_user_fk FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_updates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  note TEXT NOT NULL,
  progress TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT task_updates_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_updates_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE task_attachments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id INT UNSIGNED NOT NULL,
  update_id INT UNSIGNED NULL,
  uploaded_by INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT task_attachments_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT task_attachments_update_fk FOREIGN KEY (update_id) REFERENCES task_updates(id) ON DELETE SET NULL,
  CONSTRAINT task_attachments_user_fk FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE form_submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_slug VARCHAR(64) NOT NULL,
  facility_id INT UNSIGNED NOT NULL,
  submitted_by INT UNSIGNED NOT NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('draft', 'prepared', 'completed') NOT NULL DEFAULT 'prepared',
  prepared_by INT UNSIGNED NULL,
  prepared_at DATETIME NULL,
  completed_at DATETIME NULL,
  guest_name VARCHAR(255) NOT NULL DEFAULT '',
  guest_surname VARCHAR(255) NOT NULL DEFAULT '',
  id_number VARCHAR(64) NOT NULL DEFAULT '',
  form_data JSON NOT NULL,
  pdf_path VARCHAR(512) NULL,
  content_hash CHAR(64) NOT NULL,
  search_text TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_form_submissions_slug (form_slug),
  KEY idx_form_submissions_facility (facility_id),
  KEY idx_form_submissions_status (status),
  KEY idx_form_submissions_guest_name (guest_name),
  KEY idx_form_submissions_id_number (id_number),
  CONSTRAINT form_submissions_facility_fk FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT form_submissions_user_fk FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT form_submissions_prepared_by_fk FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO facilities (name, address, contact_name, contact_phone, contact_email) VALUES
('Grand Game Lodge', 'Sabi Sand Reserve, Mpumalanga', 'Sarah Mitchell', '+27 13 555 0101', 'lodge@grandholdings.co.za'),
('Grand Hotel Winelands', 'R44 Wine Route, Stellenbosch', 'James Nkosi', '+27 21 555 0202', 'winelands@grandholdings.co.za'),
('Grand Hotel Robertson', 'Valley Road, Robertson, Western Cape', 'Priya Pillay', '+27 23 555 0303', 'robertson@grandholdings.co.za');

INSERT INTO users (email, password_hash, name, role, facility_id, access_all) VALUES
('admin@grandholdings.co.za', '$2y$10$rMkkEnh651PMQL0oGlIYje/MyoEyUl5DHVKbd5HZZi5Y0sxz3UbQK', 'System Administrator', 'admin', NULL, 1),
('manager.cpt@grandholdings.co.za', '$2y$10$Wp94T.6UwlQHYdgj96jONeOp.NlXl2UOv5HqCwHrg1tfAFBL9PA3a', 'Lodge Manager', 'manager', 1, 0);

INSERT INTO user_facilities (user_id, facility_id) VALUES (2, 1);

INSERT INTO checklists (name, frequency) VALUES ('Daily Checks', 'daily');
INSERT INTO checklist_items (checklist_id, description, sort_order) VALUES
(1, 'Check Wi-Fi is operational', 0),
(1, 'Check telephone systems work', 1),
(1, 'Check gas levels', 2),
(1, 'Check fridge temperature levels', 3);
INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (1, 1), (1, 2), (1, 3);

SET FOREIGN_KEY_CHECKS = 1;

-- Authorization is enforced by the PHP handlers:
-- admins have all-property access and are the only users who can delete tasks;
-- managers can manage checklists/tasks within their assigned properties;
-- basic users can complete checklists and add task notes/files only.
