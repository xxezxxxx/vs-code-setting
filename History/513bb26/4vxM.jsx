import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Nav, Navbar } from "react-bootstrap";

function DetailPage(props) {
  let { id } = useParams();
  let [alert, setAlert] = useState(false);
  let [num, setNum] = useState("");
  let [tab, setTab] = useState(0);

  useEffect(() => {
    if (isNaN(num) == true) {
      setAlert(true);
    } else {
      setAlert(false);
    }
  }, [num]);

  const tempId = Number(props.shoes[id].id);
  const shoeId = props.shoes[tempId].id;

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-6">
          <img
            src={`https://codingapple1.github.io/shop/shoes${shoeId + 1}.jpg`}
            width="100%"
          />
        </div>
        <div className="col-md-6">
          {alert == true ? <div>그러지 마세요</div> : null}
          <input
            onChange={(e) => {
              setNum(e.target.value);
            }}
          />
          <h4 className="pt-5">{props.shoes[shoeId].title}</h4>
          <p>{props.shoes[shoeId].content}</p>
          <p>{props.shoes[shoeId].price}</p>
          <button className="btn btn-danger">주문하기</button>
        </div>
      </div>
      <Nav variant="tabs" defaultActiveKey="link0">
        <Nav.Item>
          <Nav.Link
            eventKey="link0"
            onClick={() => {
              setTab(0);
            }}
          >
            버튼0
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey="link1"
            onClick={() => {
              setTab(1);
            }}
          >
            버튼1
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            eventKey="link2"
            onClick={() => {
              setTab(2);
            }}
          >
            버튼2
          </Nav.Link>
        </Nav.Item>
      </Nav>
      <TabContent tab={tab} />
    </div>
  );
}

function TabContent(props) {
  useEffect(() => {
    
  }, [props.tab])

  return (
    <div className="start end">
      {[<div>내용0</div>, <div>내용1</div>, <div>내용2</div>][props.tab]}
    </div>
  );
}

export default DetailPage;
