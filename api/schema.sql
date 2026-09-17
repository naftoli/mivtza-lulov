-- Storage used only by the Mivtza Lulav API.
-- Apply manually after reviewing the task mapping notes in README.md.

CREATE TABLE IF NOT EXISTS `lulav_api_task_map` (
  `mivtzoim_id` int(10) unsigned NOT NULL,
  `school_year` smallint(5) unsigned NOT NULL,
  `field_name` enum('day','minutes') NOT NULL,
  `day_number` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `grid_id` int(10) unsigned NOT NULL,
  `start_date` mediumint(8) unsigned NOT NULL,
  `end_date` mediumint(8) unsigned NOT NULL,
  PRIMARY KEY (`mivtzoim_id`,`school_year`,`field_name`,`day_number`),
  KEY `grid_dates` (`grid_id`,`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `lulav_campaign_settings` (
  `mivtzoim_id` int(10) unsigned NOT NULL,
  `school_year` smallint(5) unsigned NOT NULL,
  `per_kid_goal` smallint(5) unsigned NOT NULL DEFAULT 3,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mivtzoim_id`,`school_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `lulav_photos` (
  `photo_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `public_id` char(32) NOT NULL,
  `mivtzoim_id` int(10) unsigned NOT NULL,
  `school_year` smallint(5) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `school_id` int(10) unsigned NOT NULL,
  `day_number` tinyint(3) unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `mime_type` enum('image/jpeg','image/png','image/webp') NOT NULL,
  `content_hash` char(64) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photo_id`),
  UNIQUE KEY `public_id` (`public_id`),
  UNIQUE KEY `report_content` (`mivtzoim_id`,`school_year`,`user_id`,`day_number`,`content_hash`),
  KEY `school_status_created` (`mivtzoim_id`,`school_year`,`school_id`,`status`,`created_at`),
  KEY `report` (`mivtzoim_id`,`school_year`,`user_id`,`day_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `lulav_school_settings` (
  `mivtzoim_id` int(10) unsigned NOT NULL,
  `school_year` smallint(5) unsigned NOT NULL,
  `school_id` int(10) unsigned NOT NULL,
  `motto` varchar(255) NOT NULL DEFAULT '',
  `color` varchar(16) NOT NULL DEFAULT '',
  `goal_override` int(10) unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mivtzoim_id`,`school_year`,`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
