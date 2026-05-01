#!/bin/bash
# deploy.sh
source .env.prod
npm run build && rsync --delete --rsync-path="sudo rsync" -rvz dist/ $DEPLOY_PATH