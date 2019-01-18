# neuroscout

[![Build Status](https://travis-ci.com/PsychoinformaticsLab/neuroscout.svg?token=mytABRBRnBitJJpBpMxh&branch=master)](https://travis-ci.com/PsychoinformaticsLab/neuroscout)
[![codecov](https://codecov.io/gh/PsychoinformaticsLab/neuroscout/branch/master/graph/badge.svg)](https://codecov.io/gh/PsychoinformaticsLab/neuroscout)

To set up docker, ensure docker and docker-compose are installed.

## Seting up environment / config variables
First, set up the main environment variables in `.env` (by copying .env.example).
Set `DATASET_DIR`, `KEY_DIR`, and `FILE_DATA` to folders on the host machine.

To set up environment variables for pliers (optional), modify `.pliersenv.example`,
configure your private keys, and save as `.pliersenv`. [More info](http://tyarkoni.github.io/pliers/installation.html#api-keys)

Next, set up the Flask server's environment variables by modifying `neuroscout/config/example_app.py`
and saving as `neuroscout/config/app.py`.

Finally, set up the frontend's env variables by modifying `neuroscout/frontend/src/config.ts.example`
and saving as `neuroscout/frontend/src/config.ts`.

## Initalizing backend
Build the containers and start services using the development configuration:

    docker-compose build
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

The server should now be running at http://localhost/

Next, initialize, migrate and upgrade the database migrations.
If you have a database file, load it using `psql`. Otherwise, delete the migrations folder,
initalize the database and add a test user.

    docker-compose exec neuroscout bash rm -rf /migrations/migrations
    docker-compose exec neuroscout python manage.py db init
    docker-compose exec neuroscout python manage.py db migrate
    docker-compose exec neuroscout python manage.py db upgrade
    docker-compose exec neuroscout python manage.py add_user useremail password

## Setting up front end
The frontend dependencies are managed using `yarn`

Enter the neuroscout image, and install all the necessary libraries like so:

    docker-compose exec neuroscout bash
    cd frontend
    yarn

You can then start a development server:

    yarn start

Or make a production build:

    yarn build

## Ingesting datasets and extracting features
You can use `manage.py` commands to ingest data into the database. At the least you want to add a user to be able to access the API.
[Note, for docker, precede commands with `docker-compose exec neuroscout`]

To add BIDS datasets

    python manage.py add_task bids_directory_path task_name

For example for dataset ds009

    python manage.py add_task /datasets/ds009 emotionalregulation

Finally, once having added a dataset to the database, you can extract features
  using pliers into the database as follows:

    python manage.py extract_features bids_directory_path task_name graph_json

For example:

    python manage.py extract_features /datasets/ds009 emotionalregulation graph.json


Even easier, is to use a preconfigured dataset config file, such as:

    docker-compose exec neuroscout python manage.py ingest_from_json /neuroscout/config/ds009.json

## Maintaining docker image and db
If you make a change to /neuroscout, you should be able to simply restart the server.

    docker-compose restart neuroscout

If you need to upgrade the db after changing any models:

    docker-compose exec neuroscout python manage.py db migrate
    docker-compose exec neuroscout python manage.py db upgrade

To inspect the database using psql:

    docker-compose run postgres psql -U postgres -h postgres

## API
Once the server is up and running, you can access the API however you'd like.

The API is document using Swagger UI at:

    http://localhost/swagger-ui

### Authorization
To authorize API requests, we use JSON Web Tokens using Flask-JWT. Simply navigate to localhost:5000/auth and post the following

    {
        "username": "user@example.com",
        "password": "string"
    }

You will receive an authorization token in return, such as:

    {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eSI6MSwiaWF0IjoxNDQ0OTE3NjQwLCJuYmYiOjE0NDQ5MTc2NDAsImV4cCI6MTQ0NDkxNzk0MH0.KPmI6WSjRjlpzecPvs3q_T3cJQvAgJvaQAPtk1abC_E"
    }

You can then insert this token into the header to authorize API requests:

    GET /protected HTTP/1.1
    Authorization: JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZGVudGl0eSI6MSwiaWF0IjoxNDQ0OTE3NjQwLCJuYmYiOjE0NDQ5MTc2NDAsImV4cCI6MTQ0NDkxNzk0MH0.KPmI6WSjRjlpzecPvs3q_T3cJQvAgJvaQAPtk1abC_E

Note that in order to use any protected routes, you must confirm the email on your account. Confusingly, you can get a valid token without confirming your account, but protected routes will not function until confirmation.


## Running tests
To run tests, after starting services, create a test database:

    docker-compose exec postgres psql -h postgres -U postgres -c "create database scout_test"

and execute:

    docker-compose run -e "APP_SETTINGS=config.app.DockerTestConfig" --rm -w /neuroscout neuroscout python -m pytest

To run frontend tests run:

    docker-compose run --rm -w /neuroscout/frontend neuroscout npm test
