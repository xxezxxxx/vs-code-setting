import "bootstrap/dist/css/bootstrap.min.css";
import { Container, Nav, Navbar } from "react-bootstrap";
import "./App.css";
import { useState } from "react";
import products from "./data.jsx";
import { Routes, Route, Link, useNavigate, Outlet } from "react-router-dom";
import DetailPage from "./pages/detail.jsx";
import styled from "styled-components";
import axios from "axios";

let YellowBtn = styled.button`
  background: ${(props) => props.$bg};
  color: ${(props) => (props.$bg == "blue" ? "white" : "black")};
  padding: 10px;
`;

let NewBtn = styled(YellowBtn)`
  padding: 50px;
`;

let Box = styled.div`
  background: grey;
  padding: 20px;
`;

function App() {
  let [shoes, setShoes] = useState(products);
  let navigate = useNavigate();

  console.log(shoes);
  function moreItems(data) {
    let newShoes = [...shoes];
    newShoes.push(data);
  }

  function actionSort() {
    let newShoes = [...shoes];

    newShoes = newShoes.sort((a, b) => {
      if (a < b) {
        return 1;
      } else {
        return -1;
      }
    });

    setShoes(newShoes);
  }

  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark">
        <Container>
          <Navbar.Brand href="/">Shop</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link
              onClick={() => {
                navigate("/");
              }}
            >
              Home
            </Nav.Link>
            <Nav.Link
              onClick={() => {
                navigate("/cart");
              }}
            >
              Cart
            </Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Routes>
        <Route
          path="/"
          element={
            <>
              <button onClick={actionSort}>정렬</button>
              <div className="main-bg"></div>
              <div className="container">
                <div className="row product-box">
                  {shoes.map(function (shoe) {
                    return (
                      <Product
                        key={shoe.id}
                        index={shoe.id}
                        title={shoe.title}
                        content={shoe.content}
                      ></Product>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    axios
                      .get(`https://codingapple1.github.io/shop/data2.json`)
                      .then((data) => {
                        console.log(data);
                      })
                      .catch(() => {
                        console.log("failed");
                      });
                  }}
                >
                  더보기
                </button>
              </div>
            </>
          }
        />

        <Route path="/detail/:id" element={<DetailPage shoes={shoes} />} />
        <Route path="/about" element={About()}>
          <Route path="member" element={<div>멤버임</div>} />
          <Route path="location" element={<div>위치임</div>} />
        </Route>
        <Route path="/event" element={Event()}>
          <Route path="one" element={<div>첫 주문시 양배추즙 서비스</div>} />
          <Route path="two" element={<div>생일기념 쿠폰받기</div>} />
        </Route>
        <Route path="*" element={<div>없는 페이지에요</div>} />
      </Routes>
    </>
  );
}

function Event() {
  return (
    <div>
      <h4>오늘의 이벤트</h4>
      <Outlet></Outlet>
    </div>
  );
}

function About() {
  return (
    <div>
      <h4>회사정보임</h4>
      <Outlet></Outlet>
    </div>
  );
}

function Product(props) {
  return (
    <div key={props.id} className="col-md-4">
      <img
        className="product-img"
        src={`https://codingapple1.github.io/shop/shoes${props.index + 1}.jpg`}
        alt=""
      />
      <h4>{props.title}</h4>
      <p>{props.content}</p>
    </div>
  );
}

export default App;
