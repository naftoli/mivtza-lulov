-- Upgrade Lulav tables created before school_year was added.
-- CREATE TABLE IF NOT EXISTS will not add this column to existing tables.
-- Safe to skip individual statements that error with "Duplicate column/key".

ALTER TABLE `lulav_api_task_map`
  ADD COLUMN `school_year` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `mivtzoim_id`;
ALTER TABLE `lulav_api_task_map` DROP PRIMARY KEY;
ALTER TABLE `lulav_api_task_map`
  ADD PRIMARY KEY (`mivtzoim_id`,`school_year`,`field_name`,`day_number`);

ALTER TABLE `lulav_campaign_settings`
  ADD COLUMN `school_year` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `mivtzoim_id`;
ALTER TABLE `lulav_campaign_settings` DROP PRIMARY KEY;
ALTER TABLE `lulav_campaign_settings`
  ADD PRIMARY KEY (`mivtzoim_id`,`school_year`);

ALTER TABLE `lulav_photos`
  ADD COLUMN `school_year` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `mivtzoim_id`;
ALTER TABLE `lulav_photos` DROP INDEX `report_content`;
ALTER TABLE `lulav_photos` DROP INDEX `school_status_created`;
ALTER TABLE `lulav_photos` DROP INDEX `report`;
ALTER TABLE `lulav_photos`
  ADD UNIQUE KEY `report_content` (`mivtzoim_id`,`school_year`,`user_id`,`day_number`,`content_hash`);
ALTER TABLE `lulav_photos`
  ADD KEY `school_status_created` (`mivtzoim_id`,`school_year`,`school_id`,`status`,`created_at`);
ALTER TABLE `lulav_photos`
  ADD KEY `report` (`mivtzoim_id`,`school_year`,`user_id`,`day_number`);

ALTER TABLE `lulav_school_settings`
  ADD COLUMN `school_year` smallint(5) unsigned NOT NULL DEFAULT 0 AFTER `mivtzoim_id`;
ALTER TABLE `lulav_school_settings` DROP PRIMARY KEY;
ALTER TABLE `lulav_school_settings`
  ADD PRIMARY KEY (`mivtzoim_id`,`school_year`,`school_id`);

-- Point existing rows at the current school year (GlobalSettings current_year).
UPDATE `lulav_api_task_map` map
  JOIN `global_settings` gs ON gs.`key` = 'current_year'
  SET map.`school_year` = CAST(gs.`val` AS UNSIGNED)
  WHERE map.`school_year` = 0;
UPDATE `lulav_campaign_settings` settings
  JOIN `global_settings` gs ON gs.`key` = 'current_year'
  SET settings.`school_year` = CAST(gs.`val` AS UNSIGNED)
  WHERE settings.`school_year` = 0;
UPDATE `lulav_photos` photo
  JOIN `global_settings` gs ON gs.`key` = 'current_year'
  SET photo.`school_year` = CAST(gs.`val` AS UNSIGNED)
  WHERE photo.`school_year` = 0;
UPDATE `lulav_school_settings` settings
  JOIN `global_settings` gs ON gs.`key` = 'current_year'
  SET settings.`school_year` = CAST(gs.`val` AS UNSIGNED)
  WHERE settings.`school_year` = 0;
