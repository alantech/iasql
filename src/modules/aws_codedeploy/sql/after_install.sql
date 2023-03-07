-- agent install
-- TODO: update code for next distros in the future
CREATE
OR REPLACE FUNCTION generate_codedeploy_agent_install_script (region TEXT, distro TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  CASE WHEN distro='ubuntu' THEN
    RETURN '#!/bin/bash
sudo apt update
sudo apt -y install ruby-full
sudo apt -y install wget
cd /home/ubuntu
wget https://aws-codedeploy-' || region || '.s3.' || region || '.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo service codedeploy-agent start';
  ELSE
    RAISE EXCEPTION 'Only Ubuntu is supported on Codedeploy agent script generation';
  END case;
END;
$$;
