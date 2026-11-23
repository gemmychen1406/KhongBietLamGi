import type { ActivityNode, AppDocument, Resource, Variant } from "../types";
let serial = 0;
const next = () => `seed-${++serial}`;
const text = (title: string, content: string): Resource => ({
  id: next(),
  type: "text",
  title,
  content,
});
const variant = (
  title: string,
  description: string,
  content?: string,
): Variant => ({
  id: next(),
  title,
  description,
  resources: content ? [text("Nội dung để bắt đầu", content)] : [],
});
const activity = (
  title: string,
  description: string,
  variants: Variant[] = [],
): ActivityNode => ({
  id: next(),
  title,
  description,
  kind: "activity",
  enabled: true,
  children: [],
  variants,
  resources: [],
});
const group = (
  title: string,
  children: ActivityNode[],
  description = "",
): ActivityNode => ({
  id: next(),
  title,
  description,
  kind: "group",
  enabled: true,
  children,
  variants: [],
  resources: [],
});
const learn = (title: string, what: string, question: string) =>
  activity(
    title,
    `Học gì: ${what}\n\nCâu hỏi gợi mở: ${question}\n\nThử dành 15 phút đọc, sau đó viết lại 3 ý bằng lời của bạn.`,
  );
const nodes: ActivityNode[] = [
  group(
    "Nội trợ",
    [
      group("Dọn dẹp", [
        group("Tủ quần áo", [
          group("Ngăn kéo", [
            activity(
              "Sắp xếp một ngăn tủ",
              "Chọn đúng một ngăn. Lấy đồ ra, lau sạch rồi chia thành ba nhóm: giữ lại, chuyển chỗ, cho đi. Chỉ cần 10 phút.",
            ),
            activity(
              "Gấp và xếp quần áo",
              "Gấp 5 món đồ đang để ngoài. Xếp đứng để dễ nhìn thấy từng món.",
            ),
          ]),
          activity(
            "Dọn tủ",
            "Chọn 3 món không còn dùng, để riêng và cân nhắc tặng hoặc tái sử dụng.",
          ),
        ]),
        activity(
          "Quét nhà",
          "Bắt đầu từ một căn phòng, quét từ góc xa ra cửa. Dành 10 phút làm gọn sàn.",
        ),
        activity(
          "Lau nhà",
          "Dọn các vật nhỏ trên sàn, vắt khăn vừa ẩm và lau một khu vực thường sử dụng.",
        ),
        activity(
          "Sắp xếp bàn học",
          "Cất 5 món về đúng chỗ, lau mặt bàn và để lại chỉ những thứ cần cho việc tiếp theo.",
        ),
      ]),
      group("Chăm sóc quần áo", [
        activity(
          "Giặt quần áo",
          "Đọc nhãn chăm sóc, phân loại đồ sáng và tối màu rồi chuẩn bị một mẻ giặt.",
        ),
        activity(
          "Phơi đồ",
          "Giũ phẳng từng món và chừa khoảng cách để đồ nhanh khô. Kiểm tra dự báo thời tiết nếu phơi ngoài trời.",
        ),
      ]),
      group("Góc bếp", [
        activity(
          "Rửa bát",
          "Dọn phần thức ăn thừa, ngâm đồ khó rửa rồi rửa từ ly cốc đến nồi chảo.",
        ),
        activity(
          "Nấu cơm",
          "Đong lượng gạo vừa đủ, vo nhẹ, thêm nước phù hợp với loại gạo và chuẩn bị một món ăn kèm đơn giản.",
        ),
      ]),
    ],
    "Một góc nhỏ gọn gàng, một ngày nhẹ nhàng.",
  ),
  group(
    "Nghệ thuật",
    [
      group("Vẽ & sắc màu", [
        group("Vẽ tranh", [
          activity(
            "Vẽ phong cảnh",
            "Dành 20 phút phác bố cục với ba mảng sáng, trung gian và tối.",
            [
              variant(
                "Rừng mùa thu",
                "Tưởng tượng một lối mòn giữa rừng, tán lá vàng cam và ánh nắng xiên. Chọn ba màu chính.",
              ),
              variant(
                "Góc biển yên bình",
                "Vẽ đường chân trời thấp, một chiếc thuyền nhỏ và các dải sóng bằng nét đơn giản.",
              ),
              variant(
                "Thành phố sau mưa",
                "Phác vài mái nhà và bóng phản chiếu. Dùng sắc xanh xám cùng một điểm nhấn ấm.",
              ),
            ],
          ),
        ]),
        activity(
          "Tô màu",
          "Vẽ một trang hình học đơn giản rồi thử giới hạn bảng màu ở ba sắc độ.",
          [
            variant(
              "Khu vườn pastel",
              "Tạo 5 hình lá và tô các sắc xanh, hồng nhạt, tím.",
            ),
            variant(
              "Những ô cửa",
              "Tô một dãy ô cửa, thay đổi độ đậm nhạt để tạo nhịp điệu.",
            ),
          ],
        ),
      ]),
      group("Thiết kế", [
        activity(
          "Thiết kế nhà",
          "Phác mặt bằng một không gian nhỏ. Ghi rõ lối đi, ánh sáng và nơi lưu trữ.",
          [
            variant(
              "Căn phòng đọc sách",
              "Một góc 3 × 3 m với kệ sách, ghế và cửa sổ. Hãy ưu tiên ánh sáng tự nhiên.",
            ),
            variant(
              "Ngôi nhà bên đồi",
              "Phác mái nhà và hiên nhìn ra vườn. Dùng vật liệu gỗ và đá trong ý tưởng.",
            ),
          ],
        ),
        activity(
          "Thiết kế trang sức",
          "Vẽ 3 phác thảo, chọn một và ghi chất liệu dự kiến.",
          [
            variant(
              "Mặt dây giọt sương",
              "Thiết kế từ đường cong mềm, một hạt thủy tinh và dây mảnh.",
            ),
            variant(
              "Chiếc nhẫn chiếc lá",
              "Lấy gân lá làm họa tiết, nghĩ về cách đeo thoải mái.",
            ),
          ],
        ),
        activity(
          "Thiết kế journal",
          "Tạo một trang ghi chép cho tuần này với ba ô: điều muốn làm, điều biết ơn và một khoảng trống sáng tạo.",
        ),
      ]),
      group("Chữ & câu chuyện", [
        activity(
          "Chép thư pháp",
          "Thả lỏng cổ tay, tập một dòng nét cơ bản rồi chép chậm đoạn nội dung.",
          [
            variant(
              "Một bước nhỏ",
              "Tập bố cục thoáng, nhấn vào các từ bạn thấy ý nghĩa.",
              "Một bước nhỏ hôm nay\nMở thêm một lối ngày mai.\nChậm thôi, nhưng cứ bước\nBình yên ở trong tay.",
            ),
            variant(
              "Khoảng trời riêng",
              "Thử viết bằng hai cỡ chữ, để khoảng trắng bao quanh.",
              "Giữ một khoảng trời trong lòng, để mỗi ngày đều có chỗ cho điều mới.",
            ),
          ],
        ),
        activity(
          "Viết văn",
          "Viết liên tục 10 phút, tạm bỏ qua việc sửa lỗi. Sau đó chọn một câu bạn thích nhất.",
          [
            variant(
              "Lá thư từ tương lai",
              "Viết một lá thư cho chính mình của một năm sau.",
              "Bạn đang ở đâu? Điều gì từng khó nhưng nay đã trở nên quen thuộc? Hãy bắt đầu bằng: “Chào bạn của ngày hôm nay…”",
            ),
            variant(
              "Một quán nhỏ trong mưa",
              "Miêu tả một quán bạn tưởng tượng bằng đủ năm giác quan.",
              "Nhân vật bước vào quán để tránh mưa và thấy một món đồ mình tưởng đã mất. Điều gì xảy ra tiếp theo?",
            ),
          ],
        ),
      ]),
      group("Âm nhạc", [
        activity(
          "Tập đàn kalimba",
          "Tập chậm từng câu, giữ nhịp đều trước khi tăng tốc. Chỉ thêm tab/bản nhạc từ nguồn bạn có quyền sử dụng.",
          [
            variant(
              "Twinkle, Twinkle, Little Star",
              "Thử tìm giai điệu bài truyền thống bằng tai, bắt đầu với các nốt Đô–Đô–Sol–Sol–La–La–Sol. Chưa có bản nhạc tham khảo.",
            ),
            variant(
              "Frère Jacques",
              "Tập giai điệu dân ca truyền thống theo từng câu ngắn. Bạn có thể thêm URL hướng dẫn của mình trong Thư viện.",
            ),
          ],
        ),
      ]),
      group("Thủ công", [
        activity(
          "Làm thiệp",
          "Gấp đôi một tờ giấy, tạo một hình cắt đơn giản và viết lời nhắn bằng chính lời của bạn.",
          [
            variant(
              "Lời cảm ơn nhỏ",
              "Làm một tấm thiệp cho người đã giúp bạn gần đây.",
            ),
            variant(
              "Chúc một ngày vui",
              "Dùng hình mặt trời và hai màu tương phản nhẹ.",
            ),
          ],
        ),
        activity(
          "Gấp origami",
          "Dùng một tờ giấy vuông để gấp một chiếc thuyền hoặc phong bì. Miết nếp gấp chậm và chính xác.",
        ),
      ]),
    ],
    "Dành một khoảng nhỏ cho trí tưởng tượng.",
  ),
  group(
    "Kiến thức",
    [
      group("Kinh tế", [
        group("Kinh tế vi mô", [
          learn(
            "Cung và cầu",
            "Cách giá và lượng cân bằng thay đổi khi cung hoặc cầu dịch chuyển.",
            "Vì sao giá một loại trái cây thường giảm vào chính vụ?",
          ),
        ]),
        group("Kinh tế vĩ mô", [
          learn(
            "Lạm phát",
            "Phân biệt mức giá chung tăng với một mặt hàng tăng giá.",
            "Vì sao mỗi gia đình có thể cảm nhận lạm phát khác nhau?",
          ),
        ]),
        group("Kinh tế hành vi", [
          learn(
            "Chi phí chìm",
            "Nhận diện khoản chi đã xảy ra và không thể thu hồi.",
            "Bạn có tiếp tục đọc một cuốn sách không thích chỉ vì đã mua nó?",
          ),
        ]),
      ]),
      group("Tâm lý học", [
        group("Tâm lý nhận thức", [
          learn(
            "Trí nhớ làm việc",
            "Vai trò của việc giữ và xử lý thông tin trong thời gian ngắn.",
            "Vì sao chia nhỏ nhiệm vụ có thể giúp bớt quá tải?",
          ),
        ]),
        group("Tâm lý xã hội", [
          learn(
            "Ảnh hưởng của nhóm",
            "Tìm hiểu sự tuân theo và áp lực đồng thuận qua các ví dụ đời thường.",
            "Khi nào ý kiến số đông giúp ích, khi nào cần kiểm chứng riêng?",
          ),
        ]),
        group("Tâm lý học phát triển", [
          learn(
            "Học qua quan sát",
            "Cách con người học hành vi từ hình mẫu và bối cảnh.",
            "Bạn đã học một kỹ năng nào chỉ bằng cách quan sát?",
          ),
        ]),
      ]),
      group("Huyền học & văn hóa", [
        group("Lịch sử tư tưởng", [
          learn(
            "Lịch sử chiêm tinh",
            "Tìm hiểu chiêm tinh trong lịch sử văn hóa; không xem dự đoán là kết luận khoa học.",
            "Thiên văn học và chiêm tinh khác nhau về cách kiểm chứng như thế nào?",
          ),
        ]),
        group("Biểu tượng văn hóa", [
          learn(
            "Biểu tượng ngũ hành",
            "Khám phá ngũ hành như một hệ biểu tượng lịch sử trong văn hóa Đông Á.",
            "Các biểu tượng này xuất hiện ra sao trong kiến trúc hoặc nghệ thuật?",
          ),
        ]),
        group("Tư duy phản biện", [
          learn(
            "Hiệu ứng Barnum",
            "Tìm hiểu vì sao mô tả chung có thể được cảm nhận như dành riêng cho mình.",
            "Làm sao thiết kế phép kiểm tra một lời dự đoán?",
          ),
        ]),
      ]),
      group("Công nghệ thông tin", [
        group("Mạng máy tính", [
          learn(
            "DNS",
            "Theo dấu quá trình chuyển tên miền thành địa chỉ IP và vai trò bộ nhớ đệm.",
            "Trình duyệt cần hỏi những đâu trước khi kết nối tới một website?",
          ),
        ]),
        group("Lập trình", [
          learn(
            "Cấu trúc dữ liệu cây",
            "Khái niệm gốc, cha, con, lá và cách duyệt cây.",
            "Bạn sẽ mô tả thư mục máy tính bằng một cấu trúc cây như thế nào?",
          ),
        ]),
        group("An toàn thông tin", [
          learn(
            "Hàm băm và mật khẩu",
            "Phân biệt băm với mã hóa và tìm hiểu vai trò của salt.",
            "Vì sao hai tài khoản cùng mật khẩu vẫn nên có giá trị lưu khác nhau?",
          ),
        ]),
      ]),
      group("Robot", [
        group("Robot công nghiệp", [
          learn(
            "Khớp và bậc tự do",
            "Phân biệt khớp quay, khớp tịnh tiến và bậc tự do.",
            "Một cánh tay robot cần bao nhiêu chuyển động độc lập để định vị và định hướng đầu công tác?",
          ),
          learn(
            "Động học thuận",
            "Từ góc khớp tính vị trí đầu công tác qua một tay máy phẳng hai khâu.",
            "Khi giữ nguyên khớp thứ nhất và xoay khớp thứ hai, đầu công tác đi theo quỹ đạo gì?",
          ),
        ]),
        group("Robot di động", [
          learn(
            "Định vị robot",
            "So sánh thông tin từ encoder, camera và cảm biến khoảng cách.",
            "Vì sao chỉ đếm vòng bánh xe có thể tích lũy sai số?",
          ),
        ]),
        group("Cảm biến robot", [
          learn(
            "Cảm biến khoảng cách",
            "So sánh nguyên lý siêu âm và đo thời gian bay của ánh sáng.",
            "Bề mặt mềm hoặc tối có thể ảnh hưởng phép đo thế nào?",
          ),
        ]),
      ]),
      group("Kỹ thuật cơ điện", [
        group("Động cơ", [
          learn(
            "Động cơ bước",
            "Cách chuỗi xung điều khiển các bước quay và khái niệm mất bước.",
            "Tại sao cần chọn gia tốc thay vì tăng tốc độ tức thì?",
          ),
        ]),
        group("Điều khiển", [
          learn(
            "Phản hồi và PID",
            "Tìm hiểu sai số và tác dụng định tính của ba thành phần P, I, D.",
            "Điều gì xảy ra nếu phản hồi quá chậm?",
          ),
        ]),
        group("Truyền động", [
          learn(
            "Vít me và đai ốc",
            "Cách chuyển chuyển động quay thành tịnh tiến.",
            "Bước vít ảnh hưởng thế nào tới tốc độ và lực?",
          ),
        ]),
      ]),
      group("Máy móc", [
        group("Cơ cấu cơ khí", [
          learn(
            "Cơ cấu tay quay – con trượt",
            "Quan sát cách chuyển chuyển động quay thành qua lại.",
            "Vì sao tốc độ con trượt không đều dù tay quay quay đều?",
          ),
        ]),
        group("Chi tiết máy", [
          learn(
            "Bánh răng và tỷ số truyền",
            "Đếm số răng để tính tỷ số tốc độ giữa hai bánh.",
            "Muốn giảm tốc và tăng mô-men, bánh bị dẫn nên lớn hay nhỏ?",
          ),
        ]),
        group("Bảo trì", [
          learn(
            "Ma sát và bôi trơn",
            "Vai trò của màng bôi trơn, nhiệt và sự mài mòn.",
            "Vì sao quá nhiều chất bôi trơn cũng có thể gây vấn đề?",
          ),
        ]),
      ]),
    ],
    "Mỗi ngày, hiểu thêm một điều mới.",
  ),
];
export function createSeedDocument(): AppDocument {
  return structuredClone({
    schemaVersion: 1,
    nodes,
    history: [],
    settings: { autoSaveHistory: true },
  });
}
