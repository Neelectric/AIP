# AIP

AIP: Invitations into the Black Box

## Commands for setup (on macOS/Linux)

Requirements: Python, pip, Node, npm

- Create a venv called aip
  - `python3 -m venv aip`

- Activate the venv
  - `source aip/bin/activate`

- In backend, install the requirements from requirements.txt
  - `cd backend`
  - `pip install -r requirements.txt`

- In frontend, install the dependencies
  - `cd ../frontend`
  - `npm i`

- Run the server
  - `cd ../backend`
  - `python main.py`

The UI will now be accessible at `localhost:5173`.
