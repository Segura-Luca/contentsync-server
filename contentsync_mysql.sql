-- MySQL dump 10.13  Distrib 9.7.1, for Win64 (x86_64)
--
-- Host: localhost    Database: contentsync
-- ------------------------------------------------------
-- Server version	9.7.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `contentsync`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `contentsync` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `contentsync`;

--
-- Table structure for table `agencies`
--

DROP TABLE IF EXISTS `agencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agencies` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tax_id` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_suspended` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agencies_owner_user_id_key` (`owner_user_id`),
  UNIQUE KEY `agencies_tax_id_key` (`tax_id`),
  KEY `agencies_is_suspended_idx` (`is_suspended`),
  KEY `agencies_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `agencies_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agencies`
--

LOCK TABLES `agencies` WRITE;
/*!40000 ALTER TABLE `agencies` DISABLE KEYS */;
INSERT INTO `agencies` VALUES ('5a3da136-169f-4b03-9d2d-0672146b6eea','6950b817-ce8f-437a-b1ff-8ab30421492b','Pulso Social Media','30-79823410-4','+52 55 3190-4455','https://pulsosocial.example.com',0,'2026-10-30 02:23:19.048','2026-10-30 02:23:19.048',NULL),('946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','Nova Digital Marketing','30-71548921-9','+54 11 4890-1122','https://novadigital.example.com',0,'2026-10-30 02:23:19.037','2026-10-30 02:23:19.037',NULL),('9c15e54d-faf2-45c3-9419-d31aa6a3b958','a8e8f57a-7289-4079-bb1a-e73ff6169309','Luca Segura Media','20-48192831-4','+54 9 11 2345-6789','https://contentsync.io',0,'2026-10-30 02:23:19.060','2026-10-30 02:23:19.060',NULL);
/*!40000 ALTER TABLE `agencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `approvals`
--

DROP TABLE IF EXISTS `approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approvals` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewer_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `decision` enum('APPROVED','CHANGES_REQUESTED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `feedback_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `approvals_video_id_created_at_idx` (`video_id`,`created_at`),
  KEY `approvals_reviewer_user_id_fkey` (`reviewer_user_id`),
  CONSTRAINT `approvals_reviewer_user_id_fkey` FOREIGN KEY (`reviewer_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `approvals_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approvals`
--

LOCK TABLES `approvals` WRITE;
/*!40000 ALTER TABLE `approvals` DISABLE KEYS */;
INSERT INTO `approvals` VALUES ('4a3abe8e-1d5a-4be0-8a79-7c72dc6f442b','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','4080c14d-acec-4deb-a102-aaf422ba71a3','APPROVED','¡Excelente iluminación y ritmo! Aprobado para las 3 redes.','2026-10-30 02:23:19.296');
/*!40000 ALTER TABLE `approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_created_at_idx` (`user_id`,`created_at`),
  KEY `audit_logs_entity_type_entity_id_idx` (`entity_type`,`entity_id`),
  CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_sessions`
--

DROP TABLE IF EXISTS `auth_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auth_sessions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_family` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_revoked` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `rotated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `auth_sessions_user_id_idx` (`user_id`),
  KEY `auth_sessions_token_family_idx` (`token_family`),
  CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_sessions`
--

LOCK TABLES `auth_sessions` WRITE;
/*!40000 ALTER TABLE `auth_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `auth_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmation_status` enum('PENDING','CONFIRMED','REJECTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONFIRMED',
  `confirmation_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_at` datetime(3) DEFAULT NULL,
  `invited_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_user_id_key` (`user_id`),
  UNIQUE KEY `clients_confirmation_token_key` (`confirmation_token`),
  KEY `clients_agency_id_idx` (`agency_id`),
  KEY `clients_confirmation_status_idx` (`confirmation_status`),
  KEY `clients_is_active_idx` (`is_active`),
  KEY `clients_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `clients_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `clients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clients`
--

LOCK TABLES `clients` WRITE;
/*!40000 ALTER TABLE `clients` DISABLE KEYS */;
INSERT INTO `clients` VALUES ('06d0f76d-2451-410a-8f27-f1863444aeee','5a3da136-169f-4b03-9d2d-0672146b6eea','8ddd28e6-052e-44e6-8dc0-b28a34f3d524','Lumina Diseño Interior','Hogar & Decoración','CONFIRMED',NULL,'2026-10-30 02:23:19.156',NULL,1,'2026-10-30 02:23:19.158','2026-10-30 02:23:19.158',NULL),('389607a1-d86a-49cc-82a2-5a3ba43182e3','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','03d62eae-2697-4181-b598-bb25000f92e5','UrbanFit Wellness Club','Fitness & Salud','CONFIRMED',NULL,'2026-10-30 02:23:19.104',NULL,1,'2026-10-30 02:23:19.106','2026-10-30 02:23:19.106',NULL),('3b777c3c-6753-40df-b67d-6db0c2621100','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','4080c14d-acec-4deb-a102-aaf422ba71a3','Kafecito Roasters S.A.','Gastronomía & Café','CONFIRMED',NULL,'2026-10-30 02:23:19.068',NULL,1,'2026-10-30 02:23:19.072','2026-10-30 02:23:19.072',NULL),('61143fcc-c961-465f-81df-048b7c3bb97f','9c15e54d-faf2-45c3-9419-d31aa6a3b958','7c0edd45-06b3-49d4-9e42-737960d1ec18','Ámbar Café & Bistró','Gastronomía & Especialidad','CONFIRMED',NULL,'2026-10-30 02:23:19.177',NULL,1,'2026-10-30 02:23:19.179','2026-10-30 02:23:19.179',NULL),('6a554e7f-6d30-4b50-8672-357459ac6db7','5a3da136-169f-4b03-9d2d-0672146b6eea','52ca9434-9915-4498-ba1a-2afc62d58bc9','TechGear Latam','E-Commerce & Tecnología','CONFIRMED',NULL,'2026-10-30 02:23:19.132',NULL,1,'2026-10-30 02:23:19.134','2026-10-30 02:23:19.134',NULL);
/*!40000 ALTER TABLE `clients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_idea_sections`
--

DROP TABLE IF EXISTS `content_idea_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_idea_sections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LIME',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_idea_sections_agency_id_name_key` (`agency_id`,`name`),
  KEY `content_idea_sections_agency_id_sort_order_idx` (`agency_id`,`sort_order`),
  CONSTRAINT `content_idea_sections_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_idea_sections`
--

LOCK TABLES `content_idea_sections` WRITE;
/*!40000 ALTER TABLE `content_idea_sections` DISABLE KEYS */;
INSERT INTO `content_idea_sections` VALUES ('2fa40a4d-a947-4e5d-adf0-7bbe0f18e194','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','Venta','EMERALD',2,'2026-10-30 02:23:19.209','2026-10-30 02:23:19.209'),('51f5bd74-bac8-4972-9e7b-d5f84075f3d4','9c15e54d-faf2-45c3-9419-d31aa6a3b958','Venta','EMERALD',2,'2026-10-30 02:23:19.233','2026-10-30 02:23:19.233'),('5212c692-839f-4e51-9bfb-fa2ed95ab932','9c15e54d-faf2-45c3-9419-d31aa6a3b958','Entretenimiento','ROSE',0,'2026-10-30 02:23:19.226','2026-10-30 02:23:19.226'),('54c0b6ff-e594-42ec-8e1b-f3e079b972bf','9c15e54d-faf2-45c3-9419-d31aa6a3b958','Educativo','SKY',1,'2026-10-30 02:23:19.229','2026-10-30 02:23:19.229'),('9f3c4b35-b63d-493e-b24c-cd1e7a8d421c','5a3da136-169f-4b03-9d2d-0672146b6eea','Venta','EMERALD',2,'2026-10-30 02:23:19.249','2026-10-30 02:23:19.249'),('b48e47a2-db8b-4e75-9e7b-10c1107c2209','5a3da136-169f-4b03-9d2d-0672146b6eea','Entretenimiento','ROSE',0,'2026-10-30 02:23:19.242','2026-10-30 02:23:19.242'),('cfaa4ebe-c7a9-4593-8133-382aa0ed9e30','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','Entretenimiento','ROSE',0,'2026-10-30 02:23:19.199','2026-10-30 02:23:19.199'),('d5a159fd-ddbc-41cf-9ac8-6548d849a091','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','Educativo','SKY',1,'2026-10-30 02:23:19.205','2026-10-30 02:23:19.205'),('e664d3fd-b96d-4cce-b4ee-bfba206e4463','5a3da136-169f-4b03-9d2d-0672146b6eea','Educativo','SKY',1,'2026-10-30 02:23:19.245','2026-10-30 02:23:19.245');
/*!40000 ALTER TABLE `content_idea_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `content_ideas`
--

DROP TABLE IF EXISTS `content_ideas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `content_ideas` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `section_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platforms` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `content_ideas_agency_id_section_id_idx` (`agency_id`,`section_id`),
  KEY `content_ideas_agency_id_client_id_idx` (`agency_id`,`client_id`),
  KEY `content_ideas_is_pinned_created_at_idx` (`is_pinned`,`created_at`),
  KEY `content_ideas_section_id_fkey` (`section_id`),
  KEY `content_ideas_client_id_fkey` (`client_id`),
  KEY `content_ideas_created_by_user_id_fkey` (`created_by_user_id`),
  CONSTRAINT `content_ideas_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `content_ideas_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `content_idea_sections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `content_ideas`
--

LOCK TABLES `content_ideas` WRITE;
/*!40000 ALTER TABLE `content_ideas` DISABLE KEYS */;
INSERT INTO `content_ideas` VALUES ('0de161bb-cfc9-4918-b765-cc0eaedfca24','5a3da136-169f-4b03-9d2d-0672146b6eea','b48e47a2-db8b-4e75-9e7b-10c1107c2209','6a554e7f-6d30-4b50-8672-357459ac6db7','6950b817-ce8f-437a-b1ff-8ab30421492b','POV: Cuando el cliente pide un café \"bien cargado\" a las 19:30','Audio en tendencia + reacción rápida del barista en barra. Corte dinámico de 15 segundos ideal para alcance orgánico.',NULL,'INSTAGRAM,TIKTOK',0,'2026-10-30 02:23:19.255','2026-10-30 02:23:19.255'),('316f5064-2f87-4499-b996-0ab2ffc531a2','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','cfaa4ebe-c7a9-4593-8133-382aa0ed9e30','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','POV: Cuando el cliente pide un café \"bien cargado\" a las 19:30','Audio en tendencia + reacción rápida del barista en barra. Corte dinámico de 15 segundos ideal para alcance orgánico.',NULL,'INSTAGRAM,TIKTOK',0,'2026-10-30 02:23:19.221','2026-10-30 02:23:19.221'),('9b3e1cfd-66fb-4192-9019-24b98c9b245d','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','2fa40a4d-a947-4e5d-adf0-7bbe0f18e194','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','Pack Degustación Origen Huila — Envío sin cargo 48 hs','Mostrar apertura de bolsa en grano, textura del tueste medio y beneficio directo para suscriptores mensuales.',NULL,'INSTAGRAM,YOUTUBE',0,'2026-10-30 02:23:19.221','2026-10-30 02:23:19.221'),('a5573fa1-6255-46f5-a69b-2c6896207816','9c15e54d-faf2-45c3-9419-d31aa6a3b958','51f5bd74-bac8-4972-9e7b-d5f84075f3d4','61143fcc-c961-465f-81df-048b7c3bb97f','a8e8f57a-7289-4079-bb1a-e73ff6169309','Pack Degustación Origen Huila — Envío sin cargo 48 hs','Mostrar apertura de bolsa en grano, textura del tueste medio y beneficio directo para suscriptores mensuales.',NULL,'INSTAGRAM,YOUTUBE',0,'2026-10-30 02:23:19.238','2026-10-30 02:23:19.238'),('b9e8787c-6f46-4a56-8b0f-02c5607c368d','5a3da136-169f-4b03-9d2d-0672146b6eea','e664d3fd-b96d-4cce-b4ee-bfba206e4463','6a554e7f-6d30-4b50-8672-357459ac6db7','6950b817-ce8f-437a-b1ff-8ab30421492b','3 errores al preparar espresso en casa (y cómo corregirlos)','Gancho primeros 2 seg mostrando extracción canalizada. Explicar molienda, compactación y temperatura. Cerrar invitando a guardar el Reel.',NULL,'INSTAGRAM,TIKTOK,YOUTUBE',1,'2026-10-30 02:23:19.255','2026-10-30 02:23:19.255'),('d12d0339-6834-490e-a1b3-023b2549c065','5a3da136-169f-4b03-9d2d-0672146b6eea','9f3c4b35-b63d-493e-b24c-cd1e7a8d421c','6a554e7f-6d30-4b50-8672-357459ac6db7','6950b817-ce8f-437a-b1ff-8ab30421492b','Pack Degustación Origen Huila — Envío sin cargo 48 hs','Mostrar apertura de bolsa en grano, textura del tueste medio y beneficio directo para suscriptores mensuales.',NULL,'INSTAGRAM,YOUTUBE',0,'2026-10-30 02:23:19.255','2026-10-30 02:23:19.255'),('d5f8e83a-d197-4346-ad7b-98e87ff97ff2','9c15e54d-faf2-45c3-9419-d31aa6a3b958','54c0b6ff-e594-42ec-8e1b-f3e079b972bf','61143fcc-c961-465f-81df-048b7c3bb97f','a8e8f57a-7289-4079-bb1a-e73ff6169309','3 errores al preparar espresso en casa (y cómo corregirlos)','Gancho primeros 2 seg mostrando extracción canalizada. Explicar molienda, compactación y temperatura. Cerrar invitando a guardar el Reel.',NULL,'INSTAGRAM,TIKTOK,YOUTUBE',1,'2026-10-30 02:23:19.238','2026-10-30 02:23:19.238'),('f43a411f-0d52-41c5-9128-10036225f6d9','9c15e54d-faf2-45c3-9419-d31aa6a3b958','5212c692-839f-4e51-9bfb-fa2ed95ab932','61143fcc-c961-465f-81df-048b7c3bb97f','a8e8f57a-7289-4079-bb1a-e73ff6169309','POV: Cuando el cliente pide un café \"bien cargado\" a las 19:30','Audio en tendencia + reacción rápida del barista en barra. Corte dinámico de 15 segundos ideal para alcance orgánico.',NULL,'INSTAGRAM,TIKTOK',0,'2026-10-30 02:23:19.238','2026-10-30 02:23:19.238'),('f4a1bff7-090f-49cc-abee-741cad000a29','946df2e6-ef5d-4ed5-a14b-ab4e2fda6d66','d5a159fd-ddbc-41cf-9ac8-6548d849a091','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','3 errores al preparar espresso en casa (y cómo corregirlos)','Gancho primeros 2 seg mostrando extracción canalizada. Explicar molienda, compactación y temperatura. Cerrar invitando a guardar el Reel.',NULL,'INSTAGRAM,TIKTOK,YOUTUBE',1,'2026-10-30 02:23:19.221','2026-10-30 02:23:19.221');
/*!40000 ALTER TABLE `content_ideas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('NEW_SCHEDULE','VIDEO_IN_REVIEW','VIDEO_APPROVED','VIDEO_CHANGES_REQUESTED','VIDEO_REJECTED','PUBLICATION_SUCCESS','PUBLICATION_FAILED','CLIENT_CONFIRMATION_REQUEST','CLIENT_CONFIRMATION_RESPONSE','SCHEDULE_DUPLICATED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_is_read_created_at_idx` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_connections`
--

DROP TABLE IF EXISTS `platform_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `platform_connections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_account_id` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_handle` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_access_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `encrypted_refresh_token` text COLLATE utf8mb4_unicode_ci,
  `token_expires_at` datetime(3) DEFAULT NULL,
  `scopes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','EXPIRED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `platform_connections_client_id_platform_key` (`client_id`,`platform`),
  KEY `platform_connections_client_id_idx` (`client_id`),
  KEY `platform_connections_status_idx` (`status`),
  CONSTRAINT `platform_connections_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_connections`
--

LOCK TABLES `platform_connections` WRITE;
/*!40000 ALTER TABLE `platform_connections` DISABLE KEYS */;
INSERT INTO `platform_connections` VALUES ('0a417572-9bd1-44b9-9c26-00cfaef7a48b','6a554e7f-6d30-4b50-8672-357459ac6db7','TIKTOK','tiktok_6a554e7f','@techgearlatam','1d2b81988f056904075007bc:e1b2d64b7396e836aeda4a27f31ceda7:0910cec6dc9f179baa05615a41dcc5d1ad92bb202422023eee1cb03a2c204fa6606775ca782ba7bf004a53f2a5ed3d038f2a03054d6eec','2cbc5543b4d70e4c3e595b6f:c57c2e84aca924242531a6a4e1a6aa8a:17796894ac081d2aef579beaaf25e7d7c36620bee7cb817900363485a77ab1aa6e18dae2ce796151b69c1f0086506ca642856a13df7414a6','2026-11-29 02:23:19.142',NULL,'ACTIVE','2026-10-30 02:23:19.144','2026-10-30 02:23:19.144'),('10e31f4b-0a37-43f0-91ae-aa0074c8da71','389607a1-d86a-49cc-82a2-5a3ba43182e3','INSTAGRAM','instagram_389607a1','@urbanfitwellnesscl','47eed4cd1744ae5b81385cfe:5ffc067c80dcdbed9f51ac6b3c034610:68d44ce51546b889af843eaef540e17e1922cfe27c5da870182b022a8d78719ec37214c8b96a70e28041face8b6515d7078302f871273ff16298','1c91da870602562efce67755:782a2b674772447a36cd7d5143850efb:37a10aa6cfbd537cbbcb1433f661e9101397e998b1013245d62b3039c5a66979aa68e4405809970d56fcc39358b046b44cd84288fa9c53b4c94025','2026-11-29 02:23:19.110',NULL,'ACTIVE','2026-10-30 02:23:19.112','2026-10-30 02:23:19.112'),('27b0f34b-a297-41ae-82ba-eeeb0bdc1b09','3b777c3c-6753-40df-b67d-6db0c2621100','YOUTUBE','youtube_3b777c3c','@kafecitoroasterssa','6e35bbfa184e0658f962451b:1131ca08140dc31e95d8d6db7bb33845:2de7bdc7e6125d593c28137717e3cb2f2144ac012274ef8c9160d0c2b6e6f965efd6b64b46de9482ae6b15651f4abcb9a28249962b5a5c95','ced3a4b0b2aed8ca7660eddd:f409cdf1151f9edfd0b62acce858ee80:0c3c248929769640c6c6faa6b976477710b5b937bed7cb40fada470a1f997ba4fbc6f4150273b3f994b0fecbbf5edabdb3a5110f0f4cf9dada','2026-11-29 02:23:19.094',NULL,'ACTIVE','2026-10-30 02:23:19.095','2026-10-30 02:23:19.095'),('3e60e6de-f960-4d49-80ff-c085ae035cb5','6a554e7f-6d30-4b50-8672-357459ac6db7','YOUTUBE','youtube_6a554e7f','@techgearlatam','a6bd2b795662432cbb146ae8:720539ddf58ec6536f62c20062ba4f36:70989b7e6bdce33ee5891cf3e834e56cdbd0a3702c5a4f16ebd1f278fd2022e54ed393cbf014abbdabd543f7816fb997bc02c74971892b3e','1e46682e87a660daa95f9000:89f85b94dd195aae1764f485f01cacfc:006c4465ccccf3ecda3fddd8186db6bb53af27bd9c88ce203c991b5a6acf18aa13920f420cd1c7d131890f80cdd2e1d581465517c90a6b1462','2026-11-29 02:23:19.146',NULL,'ACTIVE','2026-10-30 02:23:19.148','2026-10-30 02:23:19.148'),('3f459aa5-4369-4c9b-b42b-2831dc9bc0fa','61143fcc-c961-465f-81df-048b7c3bb97f','YOUTUBE','youtube_61143fcc','@mbarcafbistr','d1a0de94fc14b66897a38209:a84bd0f29a60f2e057dc3836dc0d4e27:6f1f3ccb60d1e9d49f747a926642300329f8761be68ea539bb48988a6493bc9797f9ce2f108d7687d0b261bf48f3dd2a6772a13c480258c9','3c34c53d81cf9f860575d430:ccf142fec29f38f0b924fb7c71ec0f98:bde487051433ad9bcee5abae2bbac64c57475bec27ecfe93a24350f9bf30a1ad1e94b44014e075505dc9b7020dfdfc8ae98c6f8357a791f80d','2026-11-29 02:23:19.193',NULL,'ACTIVE','2026-10-30 02:23:19.194','2026-10-30 02:23:19.194'),('5344a662-cebc-4329-a6d0-003f124908a8','3b777c3c-6753-40df-b67d-6db0c2621100','INSTAGRAM','instagram_3b777c3c','@kafecitoroasterssa','ba14162e835e7ca2598b70dd:5eaa1bbc28d0dc0c51c23b2846961c70:79b0e63930b897468a8d38d1cb79f3f8ece06ff30ac21a1bdf4d263aaaf68f99f1666453e2bd3d98fbb6948c58145fd14daab133bf9c5ba5c5f0','f844889a6c7d16ad92c9c75c:17563cf6d38808d27d78a4e62aa9929d:3d4b8da33cec6ae22584ce941145458da475bb91d247236e1785b9d78e201eb1ee6c0ec07a86cde4d1ee30a82b78f65b58509663bbc6023d278d4f','2026-11-29 02:23:19.080',NULL,'ACTIVE','2026-10-30 02:23:19.082','2026-10-30 02:23:19.082'),('632b709d-0177-456e-85e5-4b8ffeebf4fe','06d0f76d-2451-410a-8f27-f1863444aeee','TIKTOK','tiktok_06d0f76d','@luminadiseointerio','a5329e9c023f6754bc95dcdc:03d054ac69104814945fe764237bddf0:2e69a8445846a9cde29617aed6c07cbc05906bfe9947e0327bc1c432366194b27247dfbab06795ef21d477bbd256bb621ec966f254dc46','54f6e94d2a7253ba22c68e96:29e8f5f39c9f1d3d562ae974d3890112:c07edc5dad68d369d47d0bdd8aba2b358cb8b37332c4c1c39a5ac44f4770862e1b1381d0916078f8d58798e8b38d45fed002a97a217fad1f','2026-11-29 02:23:19.164',NULL,'ACTIVE','2026-10-30 02:23:19.166','2026-10-30 02:23:19.166'),('6aa59600-e3c1-4f15-bd2d-1e5264be675e','3b777c3c-6753-40df-b67d-6db0c2621100','TIKTOK','tiktok_3b777c3c','@kafecitoroasterssa','4bea812b9d50cca8020bb122:f4e07ef14b92a573d5ce75f706afb9d0:ed59eddbefa45a75ca3a2b41d6173e516cacd43c78636d44181c0b1b7f4d8df0e43cbedf2369e854aeb51fc13fcea712eae160271d7566','cf156aa443db422d5e63ccb5:7b4b86936d9c74b85bcdc598bf61108f:202eb5f1ef4b4c71ff59f812838d2d980cee52e9cffdd961817409dea945963f2bd11ced92231a73967e2430ad947f0bd42960002b6e773f','2026-11-29 02:23:19.088',NULL,'ACTIVE','2026-10-30 02:23:19.090','2026-10-30 02:23:19.090'),('7febb8b7-b8f8-45ae-9a07-d7fae7e9b8a1','61143fcc-c961-465f-81df-048b7c3bb97f','TIKTOK','tiktok_61143fcc','@mbarcafbistr','1ab71831ef9b2c82d979c0e1:6fdfba8c5941e4ddb87f3bff277295d8:f189ca45b9abfd47d1d05ca9f3e6ebcee27afc253d4176b19ec2e3a46a672f02deb05ef21bdbd5006aab373c872a163b7fe4f3c8d5b7e1','468fb3feeebd3b06614822dc:78e3a095a906647482913f2d3c02b92a:18b9c96c199467cd4e8f564edcb31b212610ceea73b2160d640b9cdf7b84840ab0941716d1910296cc83ddaccd0033d84d7de4eadfc5e5a3','2026-11-29 02:23:19.187',NULL,'ACTIVE','2026-10-30 02:23:19.189','2026-10-30 02:23:19.189'),('89937a15-452f-4f95-947d-62d5c621e66b','389607a1-d86a-49cc-82a2-5a3ba43182e3','YOUTUBE','youtube_389607a1','@urbanfitwellnesscl','6967c7530caee5dce3b378c0:d81640884fc1942efdc68c53d59d26ca:6931adfc4a0235f7c8e3dae7ec0b52ee902cf3c4712705faf1f700f7aba261fab6a06307893b375a42f8f7f6a812ca0673955349c87b4e86','fca1ee273a7fc01830cc1e54:608c063254ed89011d50354f0aa2e47d:05576aa64ae68360a32aadae9aeffccda1277fd4c28c6e77e37849aa4053c29140f5b54000eee96afb13dbc8442ffdc8bd95b36e51c8767724','2026-11-29 02:23:19.123',NULL,'ACTIVE','2026-10-30 02:23:19.125','2026-10-30 02:23:19.125'),('8e59f679-c820-4e68-b290-694c6150f6dc','389607a1-d86a-49cc-82a2-5a3ba43182e3','TIKTOK','tiktok_389607a1','@urbanfitwellnesscl','27058b390fb4b2be72d54756:a37df474e2b1d0273c8071c9c8172868:87605c3782a9b395a58de91939175195ec9b0abd39ecb05c127f4594d8604b6807530ef818c2fe764765ec4d4fd982b4bb4b0d7bc92d58','f8070965d0cf8b3e8aa9ae6c:b7baaa02db590ed9a2198c3e33506940:2ecbfaed63ee27ea17e6dc73ede3942205d4813bbbe0211819ff55fd9890c563a5207f0bfdd292a87b36861dc2afedf33abdae4848db0c80','2026-11-29 02:23:19.115',NULL,'ACTIVE','2026-10-30 02:23:19.117','2026-10-30 02:23:19.117'),('947a9e65-f99e-4f27-88ac-bc2281e4318f','06d0f76d-2451-410a-8f27-f1863444aeee','INSTAGRAM','instagram_06d0f76d','@luminadiseointerio','64c16261ecd8a7725e8b3ccd:568a5286c08977b8600f85a4a48a0e12:0a8979f82ac3b3abead6c9af5d0f7a54eb2d4aae2761a55a389b0791738d04458d71daed4cc394cc4044f37b8c1d675b726e2cc64182d6fe6c0e','18fdf2142358b13a80268c49:8a90eafd7fb0e058a82e7d348a79fb91:84df197285138b5f57fd72e8f039cfaec22f5b465377322faf4b530b225d79c70df837cca59169ce4b268eba880f3cf3af97c9d216a9bd237401f5','2026-11-29 02:23:19.160',NULL,'ACTIVE','2026-10-30 02:23:19.162','2026-10-30 02:23:19.162'),('a14ebdec-d85a-491f-b5c4-58785cde1f03','61143fcc-c961-465f-81df-048b7c3bb97f','INSTAGRAM','instagram_61143fcc','@mbarcafbistr','9f28c2374a4e4c69c6cd53e1:698a96a22689f98971c7a6b43fb51dac:2d0cf7b7a882e5f20dbdd70bc12b41c9c3eb15289c085f8195d526f186f8819b6304a29c54da0cccdb5f65ff87ec4b48e46ddc0e04b548d7d0e5','dfbb0c2eb5cfbdb4d9f840b2:0f5c91eea086f396e07ddc256914f16c:7969693b40c448bbdd7bab8785b140a229ddd3434a41265b425c88c690ee8152dc07f6980d5da6d0facd5fc02e37d858fe41b47f971c4f789c3948','2026-11-29 02:23:19.181',NULL,'ACTIVE','2026-10-30 02:23:19.183','2026-10-30 02:23:19.183'),('c6f2c4fd-d45c-4ef0-8d1d-bf0ce7719976','6a554e7f-6d30-4b50-8672-357459ac6db7','INSTAGRAM','instagram_6a554e7f','@techgearlatam','105990222592891b1fb57e9a:2a93ef8f5ab3a53df802418d7189a3d0:bf8b8a90e7541180f4c8507d0d25f011de5c1d95aee5e778bbf22088f35b7e3807d6041467d0abdcf7c3902a2f1e7a1cdeb3b13804e551ee016c','c5eb0a5607c704a67147ac3d:608e8921f02e9fa42fc2810416223dbd:94506e731c1410db20f0eade90982f74a8f74ffa9b6aeeed3f3b74d8d9a150c87c11d6bb5a86ac5bc475fa4e7a336994043dc33ec2821be0cf9b2f','2026-11-29 02:23:19.138',NULL,'ACTIVE','2026-10-30 02:23:19.140','2026-10-30 02:23:19.140'),('dfb96744-bc74-49a1-9cdb-39b22706b5fc','06d0f76d-2451-410a-8f27-f1863444aeee','YOUTUBE','youtube_06d0f76d','@luminadiseointerio','4722fe25f76fb7853ac616b0:750198c3992148e07c8f2d47a2737c2b:341e57cd3bf9e878703617f2f782b61814e025a44fe9a8ebb6000534b15e798d639cbd72b642ba34d968f70d69702aa3ba6c1df70310e9d8','25ca97bb542a4b67a96a9188:8ee2a2008f0257812c893af3dd696312:aa3b843116d1ac92b468c37dc276af3a170cfc60b934300c43c88b4fc4a7adc9c4fb8bd25bf2c649e23ee0ce3aba9990b882f7aad2e545b9bd','2026-11-29 02:23:19.169',NULL,'ACTIVE','2026-10-30 02:23:19.171','2026-10-30 02:23:19.171');
/*!40000 ALTER TABLE `platform_connections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `publication_attempts`
--

DROP TABLE IF EXISTS `publication_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publication_attempts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `publication_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_number` int NOT NULL,
  `is_success` tinyint(1) NOT NULL,
  `error_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_detail` text COLLATE utf8mb4_unicode_ci,
  `duration_ms` int NOT NULL DEFAULT '0',
  `attempted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `publication_attempts_publication_id_attempt_number_key` (`publication_id`,`attempt_number`),
  KEY `publication_attempts_publication_id_idx` (`publication_id`),
  CONSTRAINT `publication_attempts_publication_id_fkey` FOREIGN KEY (`publication_id`) REFERENCES `publications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `publication_attempts`
--

LOCK TABLES `publication_attempts` WRITE;
/*!40000 ALTER TABLE `publication_attempts` DISABLE KEYS */;
INSERT INTO `publication_attempts` VALUES ('03140c1e-66b7-4b56-acd7-af6736042955','2c091b17-42b3-4e6b-a624-2c1a012f01f7',1,1,NULL,NULL,2190,'2026-10-30 02:23:19.296'),('11647f63-8e0f-4ea1-82da-33823c5e6cb2','9bf43594-7b81-48ab-8d94-5ddbe53a72e6',1,1,NULL,NULL,1420,'2026-10-30 02:23:19.296'),('4256fafd-b46c-46f7-b879-2d1cf856f797','80774c90-a90f-4bc2-853f-7a7fbb8313f0',1,1,NULL,NULL,1850,'2026-10-30 02:23:19.296');
/*!40000 ALTER TABLE `publication_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `publications`
--

DROP TABLE IF EXISTS `publications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_for` datetime(3) NOT NULL,
  `published_at` datetime(3) DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','PUBLISHED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `bull_job_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_post_id` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_post_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `publications_video_id_platform_key` (`video_id`,`platform`),
  KEY `publications_status_scheduled_for_idx` (`status`,`scheduled_for`),
  KEY `publications_platform_status_idx` (`platform`,`status`),
  CONSTRAINT `publications_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `publications`
--

LOCK TABLES `publications` WRITE;
/*!40000 ALTER TABLE `publications` DISABLE KEYS */;
INSERT INTO `publications` VALUES ('2c091b17-42b3-4e6b-a624-2c1a012f01f7','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','YOUTUBE','2026-10-15 15:00:00.000','2026-10-15 15:00:19.000','PUBLISHED',NULL,'yt_short_AbCdEf123','https://youtube.com/shorts/AbCdEf123',NULL,'2026-10-30 02:23:19.296','2026-10-30 02:23:19.296'),('80774c90-a90f-4bc2-853f-7a7fbb8313f0','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','TIKTOK','2026-10-15 15:00:00.000','2026-10-15 15:00:15.000','PUBLISHED',NULL,'tt_vid_7741290','https://www.tiktok.com/@kafecito/video/7741290',NULL,'2026-10-30 02:23:19.296','2026-10-30 02:23:19.296'),('9bf43594-7b81-48ab-8d94-5ddbe53a72e6','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','INSTAGRAM','2026-10-15 15:00:00.000','2026-10-15 15:00:12.000','PUBLISHED',NULL,'ig_reel_9981234','https://www.instagram.com/reel/CxyzDemo1/',NULL,'2026-10-30 02:23:19.296','2026-10-30 02:23:19.296');
/*!40000 ALTER TABLE `publications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` enum('ADMIN_GENERAL','AGENCIA','CLIENTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES ('3b36b668-efdd-47c9-a912-28c0b1ddc318','CLIENTE','Cliente','Confirma su identidad, visualiza su plan semanal y aprueba videos.','2026-10-30 02:23:18.827'),('baa133a7-ba7e-472f-b677-44fd44d85d7d','AGENCIA','Agencia de Marketing','Crea y administra sus propios clientes, ideas, videos y cronogramas.','2026-10-30 02:23:18.822'),('c864c5f0-6aa8-4658-b019-d9c2ed5f32a4','ADMIN_GENERAL','Administrador General','Gestiona todo el sistema, agencias, clientes y auditoría.','2026-10-30 02:23:18.783');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_duplication_logs`
--

DROP TABLE IF EXISTS `schedule_duplication_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_duplication_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agency_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duplicated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `blocks_copied_count` int NOT NULL,
  `include_videos` tinyint(1) NOT NULL DEFAULT '0',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `schedule_duplication_logs_agency_id_created_at_idx` (`agency_id`,`created_at`),
  KEY `schedule_duplication_logs_client_id_created_at_idx` (`client_id`,`created_at`),
  KEY `schedule_duplication_logs_source_schedule_id_fkey` (`source_schedule_id`),
  KEY `schedule_duplication_logs_target_schedule_id_fkey` (`target_schedule_id`),
  KEY `schedule_duplication_logs_duplicated_by_user_id_fkey` (`duplicated_by_user_id`),
  CONSTRAINT `schedule_duplication_logs_agency_id_fkey` FOREIGN KEY (`agency_id`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_duplicated_by_user_id_fkey` FOREIGN KEY (`duplicated_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_source_schedule_id_fkey` FOREIGN KEY (`source_schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_duplication_logs_target_schedule_id_fkey` FOREIGN KEY (`target_schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_duplication_logs`
--

LOCK TABLES `schedule_duplication_logs` WRITE;
/*!40000 ALTER TABLE `schedule_duplication_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `schedule_duplication_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedule_items`
--

DROP TABLE IF EXISTS `schedule_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedule_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schedule_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `day_of_week` int NOT NULL,
  `block_title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Bloque de contenido',
  `note_color` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AMBER',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `planned_time` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '18:00',
  `planned_publish_at` datetime(3) DEFAULT NULL,
  `auto_publish` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `schedule_items_schedule_id_day_of_week_sort_order_idx` (`schedule_id`,`day_of_week`,`sort_order`),
  KEY `schedule_items_video_id_idx` (`video_id`),
  KEY `schedule_items_planned_publish_at_idx` (`planned_publish_at`),
  CONSTRAINT `schedule_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedule_items_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedule_items`
--

LOCK TABLES `schedule_items` WRITE;
/*!40000 ALTER TABLE `schedule_items` DISABLE KEYS */;
INSERT INTO `schedule_items` VALUES ('0f3542d5-7c16-4339-a26c-69b37015f95e','b8847480-be84-4bdb-8e60-054be6ecfdd7',NULL,1,'Educativo: Molienda ideal para prensa francesa','SKY','Subir Reel explicativo mostrando grosor de grano en primer plano.','11:00','2026-10-26 14:00:00.000',1,0,'2026-10-30 02:23:19.292','2026-10-30 02:23:19.292'),('1c603331-b79e-4466-843b-cf5753fca34e','b8847480-be84-4bdb-8e60-054be6ecfdd7','aac6ac79-615d-46a6-b4af-3b2c0cfec393',3,'Receta Cold Brew 45s (Video anexado)','LIME','Video ya cargado y configurado para emisión automática a las 18:00.','18:00','2026-10-28 21:00:00.000',1,0,'2026-10-30 02:23:19.292','2026-10-30 02:23:19.292'),('1d95a268-8967-457a-b30b-02166f4d6a46','f6079bad-9ea2-4753-87fc-4a8f7d1b5660',NULL,1,'Educativo: Molienda ideal para prensa francesa','SKY','Subir Reel explicativo mostrando grosor de grano en primer plano.','11:00','2026-10-26 14:00:00.000',1,0,'2026-10-30 02:23:19.277','2026-10-30 02:23:19.277'),('39c3c651-d5e6-490e-a905-852a562bc410','f6079bad-9ea2-4753-87fc-4a8f7d1b5660','32de0430-c11c-4e44-b96c-089977309853',3,'Receta Cold Brew 45s (Video anexado)','LIME','Video ya cargado y configurado para emisión automática a las 18:00.','18:00','2026-10-28 21:00:00.000',1,0,'2026-10-30 02:23:19.277','2026-10-30 02:23:19.277'),('8b4db336-c5e4-4204-aa61-dc2d5c52f12d','f6079bad-9ea2-4753-87fc-4a8f7d1b5660',NULL,5,'Venta: Degustación de Viernes 2x1 en filtrados','EMERALD','Llamado a la acción claro invitando a pasar el viernes por la tarde.','17:00','2026-10-30 20:00:00.000',1,0,'2026-10-30 02:23:19.277','2026-10-30 02:23:19.277'),('9e227f4b-30ff-49dc-874f-23c057a7c16d','b8847480-be84-4bdb-8e60-054be6ecfdd7',NULL,5,'Venta: Degustación de Viernes 2x1 en filtrados','EMERALD','Llamado a la acción claro invitando a pasar el viernes por la tarde.','17:00','2026-10-30 20:00:00.000',1,0,'2026-10-30 02:23:19.292','2026-10-30 02:23:19.292'),('ae9e026c-ae91-46b7-966d-fff509348be8','f6079bad-9ea2-4753-87fc-4a8f7d1b5660',NULL,2,'Detrás de escena: Apertura de barra 07:30 AM','AMBER','Sonido ASMR de máquina de espresso calentando y primeros clientes.','13:30','2026-10-27 16:30:00.000',1,0,'2026-10-30 02:23:19.277','2026-10-30 02:23:19.277'),('d965eef4-c389-4294-8858-07b507050a34','b8847480-be84-4bdb-8e60-054be6ecfdd7',NULL,2,'Detrás de escena: Apertura de barra 07:30 AM','AMBER','Sonido ASMR de máquina de espresso calentando y primeros clientes.','13:30','2026-10-27 16:30:00.000',1,0,'2026-10-30 02:23:19.292','2026-10-30 02:23:19.292'),('e109e0d3-fae2-4a90-a3be-0d5cd4e0b477','b8847480-be84-4bdb-8e60-054be6ecfdd7',NULL,4,'Entretenimiento: Mito vs Realidad del tueste oscuro','ROSE','Formato dinámico de preguntas rápidas con el tostador.','19:00','2026-10-29 22:00:00.000',1,0,'2026-10-30 02:23:19.292','2026-10-30 02:23:19.292'),('f6f0d04e-1ca0-446d-aabd-6f28c270139d','f6079bad-9ea2-4753-87fc-4a8f7d1b5660',NULL,4,'Entretenimiento: Mito vs Realidad del tueste oscuro','ROSE','Formato dinámico de preguntas rápidas con el tostador.','19:00','2026-10-29 22:00:00.000',1,0,'2026-10-30 02:23:19.277','2026-10-30 02:23:19.277');
/*!40000 ALTER TABLE `schedule_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedules` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duplicated_from_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `week_start_date` date NOT NULL,
  `week_end_date` date NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary_notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('DRAFT','IN_REVIEW','APPROVED','COMPLETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'IN_REVIEW',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `schedules_client_id_week_start_date_key` (`client_id`,`week_start_date`),
  KEY `schedules_client_id_week_start_date_idx` (`client_id`,`week_start_date`),
  KEY `schedules_status_idx` (`status`),
  KEY `schedules_created_by_user_id_fkey` (`created_by_user_id`),
  KEY `schedules_duplicated_from_id_fkey` (`duplicated_from_id`),
  CONSTRAINT `schedules_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `schedules_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `schedules_duplicated_from_id_fkey` FOREIGN KEY (`duplicated_from_id`) REFERENCES `schedules` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schedules`
--

LOCK TABLES `schedules` WRITE;
/*!40000 ALTER TABLE `schedules` DISABLE KEYS */;
INSERT INTO `schedules` VALUES ('b8847480-be84-4bdb-8e60-054be6ecfdd7','61143fcc-c961-465f-81df-048b7c3bb97f','a8e8f57a-7289-4079-bb1a-e73ff6169309',NULL,'2026-10-26','2026-10-30','Plan Lunes a Viernes · Especial Primavera (Ámbar)','Pauta semanal estructurada en bloques de contenido de Lunes a Viernes.','IN_REVIEW','2026-10-30 02:23:19.281','2026-10-30 02:23:19.281'),('f6079bad-9ea2-4753-87fc-4a8f7d1b5660','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50',NULL,'2026-10-26','2026-10-30','Plan Lunes a Viernes · Especial Primavera (Kafecito)','Pauta semanal estructurada en bloques de contenido de Lunes a Viernes.','IN_REVIEW','2026-10-30 02:23:19.259','2026-10-30 02:23:19.259');
/*!40000 ALTER TABLE `schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `social_auth_accounts`
--

DROP TABLE IF EXISTS `social_auth_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `social_auth_accounts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` enum('GOOGLE','FACEBOOK','GITHUB') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_auth_accounts_provider_provider_user_id_key` (`provider`,`provider_user_id`),
  KEY `social_auth_accounts_user_id_idx` (`user_id`),
  KEY `social_auth_accounts_email_idx` (`email`),
  CONSTRAINT `social_auth_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `social_auth_accounts`
--

LOCK TABLES `social_auth_accounts` WRITE;
/*!40000 ALTER TABLE `social_auth_accounts` DISABLE KEYS */;
/*!40000 ALTER TABLE `social_auth_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_reset_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_reset_expires` datetime(3) DEFAULT NULL,
  `fcm_token` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  KEY `users_email_idx` (`email`),
  KEY `users_role_id_idx` (`role_id`),
  KEY `users_deleted_at_idx` (`deleted_at`),
  CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('03d62eae-2697-4181-b598-bb25000f92e5','3b36b668-efdd-47c9-a912-28c0b1ddc318','cliente.urbanfit@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Valentina Paz (UrbanFit Gym)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.100','2026-10-30 02:23:19.100',NULL),('1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','baa133a7-ba7e-472f-b677-44fd44d85d7d','agencia.nova@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Lucas Herrera (Nova Digital)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.027','2026-10-30 02:23:19.027',NULL),('4080c14d-acec-4deb-a102-aaf422ba71a3','3b36b668-efdd-47c9-a912-28c0b1ddc318','cliente.kafecito@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Martín Rossi (Kafecito Especialidad)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.064','2026-10-30 02:23:19.064',NULL),('52ca9434-9915-4498-ba1a-2afc62d58bc9','3b36b668-efdd-47c9-a912-28c0b1ddc318','cliente.techgear@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Diego Vega (TechGear Store)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.129','2026-10-30 02:23:19.129',NULL),('6950b817-ce8f-437a-b1ff-8ab30421492b','baa133a7-ba7e-472f-b677-44fd44d85d7d','agencia.pulso@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Camila Gómez (Pulso Social Media)','America/Mexico_City',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.043','2026-10-30 02:23:19.043',NULL),('7c0edd45-06b3-49d4-9e42-737960d1ec18','3b36b668-efdd-47c9-a912-28c0b1ddc318','cliente.ambar@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Julián Méndez (Ámbar Tostadores)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.175','2026-10-30 02:23:19.175',NULL),('8ddd28e6-052e-44e6-8dc0-b28a34f3d524','3b36b668-efdd-47c9-a912-28c0b1ddc318','cliente.lumina@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Elena Silva (Lumina Deco)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.154','2026-10-30 02:23:19.154',NULL),('a8e8f57a-7289-4079-bb1a-e73ff6169309','baa133a7-ba7e-472f-b677-44fd44d85d7d','lucasegura2007@gmail.com','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','SEGURA Luca','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:19.055','2026-10-30 02:23:19.055',NULL),('f6759837-a648-454b-98e8-6e8721ff8ef9','c864c5f0-6aa8-4658-b019-d9c2ed5f32a4','admin@contentsync.io','$argon2id$v=19$m=65536,t=3,p=4$lGlJgar1IVVz7NOazMIrbw$SEJWgu9pFGfjETz8g2PNpOT6myy6i04Swe4y1o8pBmQ','Sofía Martínez (Admin General)','America/Argentina/Buenos_Aires',1,NULL,NULL,NULL,NULL,1,'2026-10-30 02:23:18.999','2026-10-30 02:23:18.999',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `video_comments`
--

DROP TABLE IF EXISTS `video_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_comments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp_sec` int DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `video_comments_video_id_created_at_idx` (`video_id`,`created_at`),
  KEY `video_comments_author_user_id_fkey` (`author_user_id`),
  CONSTRAINT `video_comments_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `video_comments_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `video_comments`
--

LOCK TABLES `video_comments` WRITE;
/*!40000 ALTER TABLE `video_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `video_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `video_hashtags`
--

DROP TABLE IF EXISTS `video_hashtags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_hashtags` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_hashtags_video_id_tag_key` (`video_id`,`tag`),
  KEY `video_hashtags_tag_idx` (`tag`),
  CONSTRAINT `video_hashtags_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `video_hashtags`
--

LOCK TABLES `video_hashtags` WRITE;
/*!40000 ALTER TABLE `video_hashtags` DISABLE KEYS */;
INSERT INTO `video_hashtags` VALUES ('03431d46-62db-4aed-a572-4941c13f7198','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','tuestedecafe',0,'2026-10-30 02:23:19.296'),('17d8bb2e-f722-4d3e-9788-38e74c8d6efc','32de0430-c11c-4e44-b96c-089977309853','reels',2,'2026-10-30 02:23:19.266'),('76c854ff-d796-41c1-bd18-4a81d66b96c7','aac6ac79-615d-46a6-b4af-3b2c0cfec393','cafedeespecialidad',1,'2026-10-30 02:23:19.286'),('ac0ff552-2d2f-4d5f-9b58-d20e28039a86','32de0430-c11c-4e44-b96c-089977309853','coldbrew',0,'2026-10-30 02:23:19.266'),('c4c9defb-5c39-437b-9cde-9093408bf329','32de0430-c11c-4e44-b96c-089977309853','cafedeespecialidad',1,'2026-10-30 02:23:19.266'),('de91ad0f-0bde-4e03-ab79-c8a346a4d575','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','colombiancoffee',1,'2026-10-30 02:23:19.296'),('df947f2c-b5b1-489e-a1e1-62b65558c879','aac6ac79-615d-46a6-b4af-3b2c0cfec393','coldbrew',0,'2026-10-30 02:23:19.286'),('e53dbdac-1f06-45b3-9d72-27e4a8bf91a8','aac6ac79-615d-46a6-b4af-3b2c0cfec393','reels',2,'2026-10-30 02:23:19.286');
/*!40000 ALTER TABLE `video_hashtags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `video_platform_targets`
--

DROP TABLE IF EXISTS `video_platform_targets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `video_platform_targets` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `video_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` enum('INSTAGRAM','TIKTOK','YOUTUBE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `custom_title` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_description` text COLLATE utf8mb4_unicode_ci,
  `privacy_level` enum('PUBLIC','UNLISTED','PRIVATE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PUBLIC',
  `share_to_feed` tinyint(1) NOT NULL DEFAULT '1',
  `allow_comments` tinyint(1) NOT NULL DEFAULT '1',
  `allow_duet_stitch` tinyint(1) NOT NULL DEFAULT '1',
  `made_for_kids` tinyint(1) NOT NULL DEFAULT '0',
  `category_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '22',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `video_platform_targets_video_id_platform_key` (`video_id`,`platform`),
  KEY `video_platform_targets_video_id_idx` (`video_id`),
  CONSTRAINT `video_platform_targets_video_id_fkey` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `video_platform_targets`
--

LOCK TABLES `video_platform_targets` WRITE;
/*!40000 ALTER TABLE `video_platform_targets` DISABLE KEYS */;
INSERT INTO `video_platform_targets` VALUES ('06976c0a-b5f4-4323-88be-02b38e91f1af','32de0430-c11c-4e44-b96c-089977309853','YOUTUBE',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.266','2026-10-30 02:23:19.266'),('44d5dba7-efa0-456f-9dce-f98b17780cee','aac6ac79-615d-46a6-b4af-3b2c0cfec393','INSTAGRAM',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.286','2026-10-30 02:23:19.286'),('56e76e5b-199a-4f6e-8a3c-3bf3d36c705c','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','INSTAGRAM',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.296','2026-10-30 02:23:19.296'),('5bc60bec-433a-43c0-ad15-37c1b0ad0210','aac6ac79-615d-46a6-b4af-3b2c0cfec393','TIKTOK',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.286','2026-10-30 02:23:19.286'),('666b9542-b2ca-4e34-8d9b-abc9e3902484','32de0430-c11c-4e44-b96c-089977309853','INSTAGRAM',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.266','2026-10-30 02:23:19.266'),('6ba65e7b-82ef-4675-838a-7c3ee623bb40','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','TIKTOK',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.296','2026-10-30 02:23:19.296'),('bae0fd36-9593-4a20-bca6-77ec740bba7a','8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','YOUTUBE',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.296','2026-10-30 02:23:19.296'),('d0eb5c96-026b-4ae1-a805-2d136c78d9d3','aac6ac79-615d-46a6-b4af-3b2c0cfec393','YOUTUBE',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.286','2026-10-30 02:23:19.286'),('dc352fc4-5100-41f4-be26-591e944e56c3','32de0430-c11c-4e44-b96c-089977309853','TIKTOK',NULL,NULL,'PUBLIC',1,1,1,0,'22','2026-10-30 02:23:19.266','2026-10-30 02:23:19.266');
/*!40000 ALTER TABLE `video_platform_targets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `videos`
--

DROP TABLE IF EXISTS `videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `videos` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail_key` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration_seconds` int NOT NULL,
  `size_bytes` bigint NOT NULL,
  `mime_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'video/mp4',
  `aspect_ratio` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '9:16',
  `workflow_status` enum('DRAFT','IN_REVIEW','CHANGES_REQUESTED','REJECTED','APPROVED','SCHEDULED','PUBLISHED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `videos_client_id_workflow_status_idx` (`client_id`,`workflow_status`),
  KEY `videos_created_at_idx` (`created_at`),
  KEY `videos_deleted_at_idx` (`deleted_at`),
  KEY `videos_uploaded_by_user_id_fkey` (`uploaded_by_user_id`),
  CONSTRAINT `videos_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `videos_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `videos`
--

LOCK TABLES `videos` WRITE;
/*!40000 ALTER TABLE `videos` DISABLE KEYS */;
INSERT INTO `videos` VALUES ('32de0430-c11c-4e44-b96c-089977309853','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','Receta Cold Brew en 45 segundos','Descubre cómo preparamos nuestro Cold Brew infusionado durante 18 horas.','clients/demo/cold-brew-recipe.mp4',NULL,45,28500000,'video/mp4','9:16','SCHEDULED','2026-10-30 02:23:19.266','2026-10-30 02:23:19.266',NULL),('8cbf5c8f-2bca-4351-aa39-f3dad3db2a9f','3b777c3c-6753-40df-b67d-6db0c2621100','1acf6d46-8b14-4e38-ac8f-2e7c1aedeb50','Tueste artesanal de granos colombianos','Así logramos el perfil achocolatado en nuestro lote Huila.','clients/kafecito/2026-10/roasting-huila.mp4',NULL,52,34100000,'video/mp4','9:16','PUBLISHED','2026-10-30 02:23:19.296','2026-10-30 02:23:19.296',NULL),('aac6ac79-615d-46a6-b4af-3b2c0cfec393','61143fcc-c961-465f-81df-048b7c3bb97f','a8e8f57a-7289-4079-bb1a-e73ff6169309','Receta Cold Brew en 45 segundos','Descubre cómo preparamos nuestro Cold Brew infusionado durante 18 horas.','clients/demo/cold-brew-recipe.mp4',NULL,45,28500000,'video/mp4','9:16','SCHEDULED','2026-10-30 02:23:19.286','2026-10-30 02:23:19.286',NULL);
/*!40000 ALTER TABLE `videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'contentsync'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 23:43:47
