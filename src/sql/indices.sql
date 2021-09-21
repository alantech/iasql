CREATE UNIQUE INDEX region_name_idx ON region (region_name);

CREATE UNIQUE INDEX availability_zone_id_idx ON availability_zone (zone_id);

CREATE UNIQUE INDEX instance_type_idx ON instance_type (instance_type);

CREATE UNIQUE INDEX image_id_idx ON ami (image_id);