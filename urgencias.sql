-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 16-11-2026 a las 17:25:53
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `urgencias`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estados`
--

CREATE TABLE `estados` (
  `id_estado` int(11) NOT NULL,
  `codigo` varchar(30) NOT NULL,
  `nombre` varchar(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `estados`
--

INSERT INTO `estados` (`id_estado`, `codigo`, `nombre`) VALUES
(1, 'en_espera', 'En espera'),
(2, 'en_atencion', 'En atención'),
(3, 'en_observacion', 'En observación'),
(4, 'alta', 'Alta médica'),
(5, 'transferido', 'Transferido');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medicos`
--

CREATE TABLE `medicos` (
  `id_medico` int(11) NOT NULL,
  `nombre` varchar(60) NOT NULL,
  `usuario` varchar(40) NOT NULL,
  `clave` varchar(200) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `medicos`
--

INSERT INTO `medicos` (`id_medico`, `nombre`, `usuario`, `clave`, `activo`) VALUES
(1, 'Dr. Ramírez', 'ramirez', '873a1451acb00ae9ca2b586637d6c066:46e7439fcb42a39d1a94f87b98c8d3fd8153055b080e6eb273d78fc2d944e73747fcda019f65c90225445f330eb1fa69d47f9702f89ea93c290ec4c35716f5f0', 1),
(2, 'Dra. Chen', 'chen', '616decc8c14970d9e64457ea2da9639a:ddb284519a9b55a33207bc615787b5f1268e3ba6907f6998227fbece7470afa8df0ccd94e3646595b6cb716dd041af786b2890fa4f63fcae802dbd59b8a20669', 1),
(3, 'Dr. Morales', 'morales', '68039d888d94a1e130f9c5e0c7ccd6ab:f95b53ca7ae1d566fd4421004830b917a7d14e34fc46076c00f5d995c394388f82f75586f1a2ddd88e1255b9ba63e56148cb1fe8b76942dcdb2efa77b0ad0bb2', 1),
(4, 'Maximo', 'MaximoBianco', '$2a$12$JYQ5Pi/0szjAlHR.RkhTWumzFN4uj0.h72jB5oO.8oF7r.cCZnSHi', 1),
(5, 'Dr. Maximo', 'maximo', 'dfd20b9345407861969a20b5ab67e275:977932f66d98906ca5cf86554560280044c896831d92dc6f2424f764d6b90c32feb44dfbf4882604933fa05038fe8ba2f944df4279a3c5ba4e97a3290c45be5c', 1),
(6, 'dra del palacio', 'gatosuwu', 'd5dd0c28f6e2b33c5a9dfe3253de2cb4:b346ff3bca1494df2bb57a157487c68cf9df7874cfb76e9f14b941e7a30351fdc38b53189e2f64aac263f99a3ee77e6714a0676d470785ffbbcb657ce93a0d5e', 1),
(7, 'Dr. Joaquin Sallago', 'sashagod', '690c9fd4998b79fe64a2e191becc4dc4:1977e877900ee249b42ba86ecd371fddf80daaa41571162b6632e2be7023e8d9a2c84facb3e6cf89f5ca5f4d3738fca44d0b693a947d50cd15357d1eda807887', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sala_medica`
--

CREATE TABLE `sala_medica` (
  `pacient_id` int(11) NOT NULL,
  `folio` varchar(12) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `edad` tinyint(3) UNSIGNED NOT NULL,
  `sexo` enum('M','F') NOT NULL,
  `triage` tinyint(3) UNSIGNED NOT NULL,
  `motivo_consulta` text NOT NULL,
  `ta` varchar(10) DEFAULT '—',
  `fc` smallint(5) UNSIGNED DEFAULT 0,
  `temperatura` decimal(3,1) DEFAULT 36.5,
  `spo2` tinyint(3) UNSIGNED DEFAULT 98,
  `notas` text DEFAULT NULL,
  `hora_ingreso` time NOT NULL,
  `t_espera` int(11) NOT NULL DEFAULT 0,
  `id_medico` int(11) NOT NULL,
  `id_estado` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `estados`
--
ALTER TABLE `estados`
  ADD PRIMARY KEY (`id_estado`),
  ADD UNIQUE KEY `codigo` (`codigo`);

--
-- Indices de la tabla `medicos`
--
ALTER TABLE `medicos`
  ADD PRIMARY KEY (`id_medico`),
  ADD UNIQUE KEY `usuario` (`usuario`);

--
-- Indices de la tabla `sala_medica`
--
ALTER TABLE `sala_medica`
  ADD PRIMARY KEY (`pacient_id`),
  ADD UNIQUE KEY `folio` (`folio`),
  ADD KEY `fk_sm_med` (`id_medico`),
  ADD KEY `fk_sm_est` (`id_estado`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `estados`
--
ALTER TABLE `estados`
  MODIFY `id_estado` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `medicos`
--
ALTER TABLE `medicos`
  MODIFY `id_medico` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `sala_medica`
--
ALTER TABLE `sala_medica`
  MODIFY `pacient_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sala_medica`
--
ALTER TABLE `sala_medica`
  ADD CONSTRAINT `fk_sm_est` FOREIGN KEY (`id_estado`) REFERENCES `estados` (`id_estado`),
  ADD CONSTRAINT `fk_sm_med` FOREIGN KEY (`id_medico`) REFERENCES `medicos` (`id_medico`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
